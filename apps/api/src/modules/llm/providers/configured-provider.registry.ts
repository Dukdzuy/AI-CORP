import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ILLMProvider } from '@ai-corp/shared-types';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ILlmProviderRepository,
  LLM_PROVIDER_REPOSITORY,
  LlmProviderConfig,
  ProviderKind,
  SECRET_CIPHER,
  SecretCipher,
} from '../../../domain/llm';
import { ProviderStrategyRegistry } from './provider-strategy.registry';
import { NINE_ROUTER_DEFAULT_MODELS, NINE_ROUTER_PROVIDER_NAME } from './nine-router-defaults';

/**
 * Chat clients of the providers configured in the app, built once and rebuilt after any
 * change (reload), so LLMProviderFactory can stay synchronous.
 *
 * On first start (no provider rows) it imports the 9Router gateway from NINE_ROUTER_URL /
 * NINE_ROUTER_API_KEY with the default model list, and points agents on 9Router at it,
 * so existing installs show up on the Providers page without manual setup.
 *
 * @pattern Registry (cache of Strategy-built clients)
 */
@Injectable()
export class ConfiguredProviderRegistry implements OnModuleInit {
  private readonly logger = new Logger(ConfiguredProviderRegistry.name);
  private clients = new Map<string, ILLMProvider>();

  constructor(
    @Inject(LLM_PROVIDER_REPOSITORY) private readonly providers: ILlmProviderRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    private readonly strategies: ProviderStrategyRegistry,
    private readonly prisma: PrismaService
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.importNineRouterFromEnv();
      await this.reload();
    } catch (e) {
      this.logger.warn(`Configured LLM providers not loaded: ${(e as Error).message}`);
    }
  }

  /** Rebuilds the clients of enabled providers; call after any provider change */
  async reload(): Promise<void> {
    const next = new Map<string, ILLMProvider>();
    for (const provider of await this.providers.findAll()) {
      if (!provider.isEnabled) continue;
      try {
        next.set(provider.id, this.strategies.for(provider.kind).createClient(provider.connection(this.cipher)));
      } catch (e) {
        // e.g. the API key was sealed with another LLM_SECRET_KEY
        this.logger.warn(`Provider '${provider.name}' skipped: ${(e as Error).message}`);
      }
    }
    this.clients = next;
    this.logger.log(`Loaded ${next.size} configured LLM provider(s)`);
  }

  clientFor(providerId: string): ILLMProvider | null {
    return this.clients.get(providerId) ?? null;
  }

  private async importNineRouterFromEnv(): Promise<void> {
    const baseUrl = process.env.NINE_ROUTER_URL;
    if (!baseUrl || (await this.providers.count()) > 0) return;

    const provider = LlmProviderConfig.create(
      { name: NINE_ROUTER_PROVIDER_NAME, kind: ProviderKind.OPENAI_COMPATIBLE, baseUrl, apiKey: process.env.NINE_ROUTER_API_KEY },
      this.cipher
    );
    for (const m of NINE_ROUTER_DEFAULT_MODELS) provider.addModel(m);

    const agents = await this.prisma.agent.findMany({ select: { role: true, modelRouteConfig: true } });
    const onNineRouter = agents.filter(a => {
      const config = (a.modelRouteConfig ?? {}) as Record<string, any>;
      return !config.providerId && ['ninerouter', 'opencode', undefined].includes(config.provider);
    });
    // Keep every model an agent already runs on
    for (const a of onNineRouter) {
      const model = (a.modelRouteConfig as Record<string, any>)?.model;
      if (model && !provider.findModel(model)) provider.addModel({ modelId: model });
    }
    await this.providers.save(provider);

    for (const a of onNineRouter) {
      await this.prisma.agent.update({
        where: { role: a.role },
        data: { modelRouteConfig: { ...(a.modelRouteConfig as object), providerId: provider.id } as Prisma.InputJsonValue },
      });
    }
    this.logger.log(`Imported 9Router (${baseUrl}) as a configured provider; ${onNineRouter.length} agent(s) linked`);
  }
}

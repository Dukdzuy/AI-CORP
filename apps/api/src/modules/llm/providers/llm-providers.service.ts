import { BadRequestException, ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  ILlmProviderRepository,
  LLM_PROVIDER_REPOSITORY,
  LlmProviderConfig,
  LlmProviderError,
  SECRET_CIPHER,
  SecretCipher,
} from '../../../domain/llm';
import { ConfiguredProviderRegistry } from './configured-provider.registry';
import { ProviderStrategyRegistry } from './provider-strategy.registry';
import { NINE_ROUTER_DEFAULT_MODELS } from './nine-router-defaults';
import {
  AddLlmModelDto,
  AssignAgentModelDto,
  CreateLlmProviderDto,
  UpdateLlmModelDto,
  UpdateLlmProviderDto,
} from './llm-providers.dto';

/** One entry of the model picker on the Agent Models page */
export interface ModelOption {
  key: string;
  id: string;
  name: string;
  providerId: string | null;
  provider: string;
  category: string;
}

/**
 * Use cases of the Providers page: manage providers and their models, test a connection,
 * browse a provider's own model list, and assign a model to an agent. Every change
 * reloads ConfiguredProviderRegistry so the next agent call uses it.
 *
 * @pattern Application Service (Facade over the repository, strategies and registry)
 */
@Injectable()
export class LlmProvidersService {
  constructor(
    @Inject(LLM_PROVIDER_REPOSITORY) private readonly providers: ILlmProviderRepository,
    @Inject(SECRET_CIPHER) private readonly cipher: SecretCipher,
    private readonly strategies: ProviderStrategyRegistry,
    private readonly registry: ConfiguredProviderRegistry,
    private readonly prisma: PrismaService
  ) {}

  async list() {
    const [providers, usage] = await Promise.all([this.providers.findAll(), this.agentUsage()]);
    return providers.map(p => ({ ...p.toView(), usedBy: usage.filter(u => u.providerId === p.id).map(u => u.role) }));
  }

  kinds() {
    return this.strategies.kinds();
  }

  async create(dto: CreateLlmProviderDto) {
    if (await this.providers.findByName(dto.name.trim())) throw new ConflictException(`A provider named '${dto.name.trim()}' already exists`);
    const provider = this.domain(() => LlmProviderConfig.create(dto, this.cipher));
    return this.persist(provider);
  }

  async update(id: string, dto: UpdateLlmProviderDto) {
    const provider = await this.get(id);
    if (dto.name && dto.name.trim() !== provider.name) {
      const clash = await this.providers.findByName(dto.name.trim());
      if (clash && clash.id !== id) throw new ConflictException(`A provider named '${dto.name.trim()}' already exists`);
    }
    if (dto.isEnabled === false) await this.assertUnused(id, null, 'disable');
    this.domain(() =>
      provider.update({ name: dto.name, kind: dto.kind, baseUrl: dto.baseUrl, apiKey: dto.clearApiKey ? null : dto.apiKey, isEnabled: dto.isEnabled }, this.cipher)
    );
    return this.persist(provider);
  }

  async remove(id: string) {
    const provider = await this.get(id);
    await this.assertUnused(id, null, 'delete');
    await this.providers.delete(id);
    await this.registry.reload();
    return { id: provider.id, deleted: true };
  }

  /** Lists the provider's models to check the URL and key; never throws on a bad provider */
  async test(id: string) {
    const started = Date.now();
    try {
      const models = await this.fetchRemoteModels(await this.get(id));
      return { ok: true, modelCount: models.length, latencyMs: Date.now() - started };
    } catch (e) {
      if (e instanceof NotFoundException) throw e;
      return { ok: false, error: this.describe(e), latencyMs: Date.now() - started };
    }
  }

  /** The provider's own model list, marking those already added */
  async remoteModels(id: string) {
    const provider = await this.get(id);
    try {
      const models = await this.fetchRemoteModels(provider);
      return models
        .map(m => ({ ...m, added: !!provider.findModel(m.modelId) }))
        .sort((a, b) => a.modelId.localeCompare(b.modelId));
    } catch (e) {
      throw new BadRequestException(`Could not list models of ${provider.name}: ${this.describe(e)}`);
    }
  }

  async addModels(id: string, models: AddLlmModelDto[], fromProvider = false) {
    const provider = await this.get(id);
    this.domain(() => {
      if (fromProvider) return provider.mergeSyncedModels(models);
      for (const m of models) {
        if (!provider.findModel(m.modelId.trim())) provider.addModel(m);
      }
    });
    return this.persist(provider);
  }

  async updateModel(id: string, modelId: string, dto: UpdateLlmModelDto) {
    const provider = await this.get(id);
    const model = this.domain(() => provider.modelById(modelId));
    if (dto.isEnabled === false) await this.assertUnused(id, model.modelId, 'disable');
    model.update(dto);
    return this.persist(provider);
  }

  async removeModel(id: string, modelId: string) {
    const provider = await this.get(id);
    const model = this.domain(() => provider.modelById(modelId));
    await this.assertUnused(id, model.modelId, 'delete');
    provider.removeModel(modelId);
    return this.persist(provider);
  }

  // ---- Agent model selection -----------------------------------------------

  /** Models agents may use: enabled models of enabled providers (the 9Router defaults when none is configured) */
  async modelOptions(): Promise<ModelOption[]> {
    const providers = await this.providers.findAll();
    if (providers.length === 0) {
      return NINE_ROUTER_DEFAULT_MODELS.map(m => ({
        key: m.modelId, id: m.modelId, name: m.displayName, providerId: null, provider: 'ninerouter', category: m.category,
      }));
    }
    return providers
      .filter(p => p.isEnabled)
      .flatMap(p =>
        p.enabledModels().map(m => {
          const v = m.toPrimitives();
          return { key: `${p.id}::${v.modelId}`, id: v.modelId, name: v.displayName, providerId: p.id, provider: p.name, category: v.category };
        })
      );
  }

  async assignAgentModel(role: string, dto: AssignAgentModelDto) {
    const agent = await this.prisma.agent.findUnique({ where: { role: role.toUpperCase() } });
    if (!agent) throw new NotFoundException(`Agent ${role} not found`);
    const current = (agent.modelRouteConfig ?? {}) as Record<string, any>;
    let config: Record<string, any>;

    if (dto.providerId) {
      const provider = await this.get(dto.providerId);
      if (!provider.isEnabled) throw new BadRequestException(`Provider ${provider.name} is disabled`);
      const model = provider.findModel(dto.model);
      if (!model?.isEnabled) throw new BadRequestException(`Model '${dto.model}' is not an enabled model of ${provider.name}`);
      config = { ...current, provider: provider.name, providerId: provider.id, model: dto.model };
    } else {
      const { providerId: _drop, ...rest } = current;
      config = { ...rest, provider: current.providerId ? 'ninerouter' : current.provider ?? 'ninerouter', model: dto.model };
    }

    const updated = await this.prisma.agent.update({
      where: { role: role.toUpperCase() },
      data: { modelRouteConfig: config as Prisma.InputJsonValue },
    });
    return { success: true, agent: updated };
  }

  // ---- helpers ----------------------------------------------------------------

  private async get(id: string): Promise<LlmProviderConfig> {
    const provider = await this.providers.findById(id);
    if (!provider) throw new NotFoundException(`Provider ${id} not found`);
    return provider;
  }

  private async persist(provider: LlmProviderConfig) {
    await this.providers.save(provider);
    await this.registry.reload();
    const usage = await this.agentUsage();
    return { ...provider.toView(), usedBy: usage.filter(u => u.providerId === provider.id).map(u => u.role) };
  }

  private fetchRemoteModels(provider: LlmProviderConfig) {
    return this.strategies.for(provider.kind).listModels(provider.connection(this.cipher));
  }

  private async agentUsage(): Promise<Array<{ role: string; providerId?: string; model?: string }>> {
    const agents = await this.prisma.agent.findMany({ select: { role: true, modelRouteConfig: true } });
    return agents.map(a => {
      const config = (a.modelRouteConfig ?? {}) as Record<string, any>;
      return { role: a.role, providerId: config.providerId, model: config.model };
    });
  }

  /** A provider or model an agent runs on cannot be removed or disabled: pick another model first */
  private async assertUnused(providerId: string, modelId: string | null, verb: string) {
    const users = (await this.agentUsage()).filter(u => u.providerId === providerId && (modelId === null || u.model === modelId));
    if (users.length) {
      throw new ConflictException(`Cannot ${verb}: used by agent(s) ${users.map(u => u.role).join(', ')}. Switch them to another model first.`);
    }
  }

  private domain<T>(fn: () => T): T {
    try {
      return fn();
    } catch (e) {
      if (e instanceof LlmProviderError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  private describe(e: unknown): string {
    const err = e as any;
    const status = err?.status ?? err?.response?.status;
    const message = err?.response?.data?.error?.message ?? err?.error?.message ?? err?.message ?? String(e);
    return status ? `${status} ${message}` : message;
  }
}

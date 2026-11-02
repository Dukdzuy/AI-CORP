/**
 * Providers & models configured from the web app: the encrypted API key, the provider
 * aggregate, the application service and the factory routing an agent to its provider.
 * Persistence is in memory; provider HTTP calls are stubbed.
 */
import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
import { ChatParams, ChatResult, ILLMProvider } from '@ai-corp/shared-types';
import { AesGcmSecretCipher } from '../../../src/infrastructure/security/AesGcmSecretCipher';
import { ILlmProviderRepository, LlmProviderConfig, ProviderConnection, ProviderKind } from '../../../src/domain/llm';
import { ProviderStrategy, RemoteModel } from '../../../src/modules/llm/providers/provider-strategy';
import { ProviderStrategyRegistry } from '../../../src/modules/llm/providers/provider-strategy.registry';
import { ConfiguredProviderRegistry } from '../../../src/modules/llm/providers/configured-provider.registry';
import { LlmProvidersService } from '../../../src/modules/llm/providers/llm-providers.service';
import { LLMProviderFactory } from '../../../src/modules/llm/llm-provider.factory';
import { NineRouterProvider } from '../../../src/modules/llm/nine-router-provider';

Logger.overrideLogger(false);

const cipher = new AesGcmSecretCipher('test-secret');

class InMemoryLlmProviderRepository implements ILlmProviderRepository {
  rows = new Map<string, ReturnType<LlmProviderConfig['toPrimitives']>>();
  async save(p: LlmProviderConfig) { this.rows.set(p.id, p.toPrimitives()); }
  async findById(id: string) { const r = this.rows.get(id); return r ? LlmProviderConfig.fromPersistence(r.provider, r.models) : null; }
  async findByName(name: string) { return (await this.findAll()).find(p => p.name === name) ?? null; }
  async findAll() { return [...this.rows.values()].map(r => LlmProviderConfig.fromPersistence(r.provider, r.models)); }
  async delete(id: string) { this.rows.delete(id); }
  async count() { return this.rows.size; }
}

class FakeClient implements ILLMProvider {
  constructor(readonly connection: ProviderConnection) {}
  async chat(params: ChatParams): Promise<ChatResult> {
    return { content: 'ok', requestedModel: params.model, actualModelUsed: params.model, actualProvider: this.connection.name, isFallbackTriggered: false, tokenUsage: { promptTokens: 1, completionTokens: 1, totalTokens: 2 } } as ChatResult;
  }
  async validateConfig() { return true; }
  getProviderName() { return this.connection.name; }
}

class StubStrategy implements ProviderStrategy {
  readonly defaultBaseUrl = 'http://stub/v1';
  remote: RemoteModel[] = [{ modelId: 'gpt-4o-mini' }, { modelId: 'gpt-4o' }];
  fail = false;
  constructor(readonly kind: ProviderKind) {}
  createClient(connection: ProviderConnection) { return new FakeClient(connection); }
  async listModels() {
    if (this.fail) throw Object.assign(new Error('Incorrect API key'), { status: 401 });
    return this.remote;
  }
}

function fakePrisma(agents: Array<{ role: string; modelRouteConfig: any }>) {
  return {
    agent: {
      findMany: async () => agents.map(a => ({ ...a })),
      findUnique: async ({ where }: any) => agents.find(a => a.role === where.role) ?? null,
      update: async ({ where, data }: any) => {
        const a = agents.find(x => x.role === where.role)!;
        a.modelRouteConfig = data.modelRouteConfig;
        return a;
      },
    },
  } as any;
}

function setup(agents: Array<{ role: string; modelRouteConfig: any }> = [{ role: 'DEV', modelRouteConfig: { provider: 'ninerouter', model: 'cx/gpt-5.4' } }]) {
  const repo = new InMemoryLlmProviderRepository();
  const openai = new StubStrategy(ProviderKind.OPENAI_COMPATIBLE);
  const strategies = new ProviderStrategyRegistry(openai as any, new StubStrategy(ProviderKind.ANTHROPIC) as any);
  const prisma = fakePrisma(agents);
  const registry = new ConfiguredProviderRegistry(repo, cipher, strategies, prisma);
  const service = new LlmProvidersService(repo, cipher, strategies, registry, prisma);
  return { repo, openai, registry, service, agents, factory: new LLMProviderFactory(undefined, registry) };
}

describe('AesGcmSecretCipher', () => {
  it('round-trips a secret and never stores it in clear', () => {
    const sealed = cipher.encrypt('sk-live-123456');
    expect(sealed).not.toContain('sk-live');
    expect(sealed.startsWith('v1:')).toBe(true);
    expect(cipher.decrypt(sealed)).toBe('sk-live-123456');
    expect(cipher.encrypt('sk-live-123456')).not.toBe(sealed); // random IV
  });

  it('rejects a tampered value or another key', () => {
    const sealed = cipher.encrypt('secret');
    const parts = sealed.split(':');
    parts[3] = Buffer.from('other!').toString('base64');
    expect(() => cipher.decrypt(parts.join(':'))).toThrow();
    expect(() => new AesGcmSecretCipher('another-secret').decrypt(sealed)).toThrow();
  });
});

describe('LlmProviderConfig', () => {
  it('keeps the API key encrypted and shows only a hint', () => {
    const p = LlmProviderConfig.create({ name: 'OpenAI', kind: 'openai-compatible', baseUrl: 'https://api.openai.com/v1/', apiKey: 'sk-abcdWXYZ' }, cipher);
    const view = p.toView();
    expect(JSON.stringify(view)).not.toContain('sk-abcd');
    expect(view).toMatchObject({ hasApiKey: true, apiKeyHint: '••••WXYZ', baseUrl: 'https://api.openai.com/v1' });
    expect(p.connection(cipher).apiKey).toBe('sk-abcdWXYZ');
  });

  it('validates name, kind and base URL', () => {
    expect(() => LlmProviderConfig.create({ name: ' ', kind: 'openai-compatible' }, cipher)).toThrow(/name/);
    expect(() => LlmProviderConfig.create({ name: 'X', kind: 'gemini' }, cipher)).toThrow(/kind/);
    expect(() => LlmProviderConfig.create({ name: 'X', kind: 'anthropic', baseUrl: 'ftp://x' }, cipher)).toThrow(/http/);
  });

  it('keeps the key on an empty update and clears it on null', () => {
    const p = LlmProviderConfig.create({ name: 'X', kind: 'anthropic', apiKey: 'key-1234' }, cipher);
    p.update({ apiKey: '' }, cipher);
    expect(p.connection(cipher).apiKey).toBe('key-1234');
    p.update({ apiKey: null }, cipher);
    expect(p.toView().hasApiKey).toBe(false);
  });

  it('adds models once and merges synced ones', () => {
    const p = LlmProviderConfig.create({ name: 'X', kind: 'openai-compatible' }, cipher);
    p.addModel({ modelId: 'a' });
    expect(() => p.addModel({ modelId: 'a' })).toThrow(/already exists/);
    expect(p.mergeSyncedModels([{ modelId: 'a' }, { modelId: 'b' }, { modelId: '' }])).toBe(1);
    expect(p.toView().models.map(m => [m.modelId, m.source])).toEqual([['a', 'manual'], ['b', 'synced']]);
  });
});

describe('LlmProvidersService', () => {
  it('creates a provider, lists remote models and adds chosen ones', async () => {
    const { service } = setup();
    const created = await service.create({ name: 'OpenAI', kind: 'openai-compatible', apiKey: 'sk-test-9999' });
    expect(created).not.toHaveProperty('apiKeyEncrypted');
    expect(created.apiKeyHint).toBe('••••9999');

    const remote = await service.remoteModels(created.id);
    expect(remote.map(m => [m.modelId, m.added])).toEqual([['gpt-4o', false], ['gpt-4o-mini', false]]);

    const updated = await service.addModels(created.id, [{ modelId: 'gpt-4o-mini' }], true);
    expect(updated.models.map(m => [m.modelId, m.source])).toEqual([['gpt-4o-mini', 'synced']]);
    const manual = await service.addModels(created.id, [{ modelId: 'o3', category: 'reasoning' }]);
    expect(manual.models.map(m => [m.modelId, m.source, m.category])).toContainEqual(['o3', 'manual', 'reasoning']);
    expect((await service.remoteModels(created.id)).find(m => m.modelId === 'gpt-4o-mini')!.added).toBe(true);
    await expect(service.create({ name: 'OpenAI', kind: 'anthropic' })).rejects.toBeInstanceOf(ConflictException);
  });

  it('reports a failed connection test instead of throwing', async () => {
    const { service, openai } = setup();
    const p = await service.create({ name: 'Groq', kind: 'openai-compatible', apiKey: 'bad' });
    openai.fail = true;
    expect(await service.test(p.id)).toMatchObject({ ok: false, error: '401 Incorrect API key' });
    await expect(service.remoteModels(p.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('assigns an agent a configured model and the factory routes it there', async () => {
    const { service, agents, factory } = setup();
    const p = await service.create({ name: 'OpenRouter', kind: 'openai-compatible', apiKey: 'k' });
    await service.addModels(p.id, [{ modelId: 'google/gemma-4' }]);

    await expect(service.assignAgentModel('dev', { model: 'not-added', providerId: p.id })).rejects.toBeInstanceOf(BadRequestException);
    await service.assignAgentModel('dev', { model: 'google/gemma-4', providerId: p.id });
    expect(agents[0].modelRouteConfig).toMatchObject({ provider: 'OpenRouter', providerId: p.id, model: 'google/gemma-4' });

    const client = factory.getProvider(agents[0].modelRouteConfig) as FakeClient;
    expect(client).toBeInstanceOf(FakeClient);
    expect(client.connection).toMatchObject({ name: 'OpenRouter', apiKey: 'k' });

    const options = await service.modelOptions();
    expect(options).toEqual([expect.objectContaining({ key: `${p.id}::google/gemma-4`, providerId: p.id, provider: 'OpenRouter' })]);
  });

  it('refuses to delete or disable what an agent runs on', async () => {
    const { service } = setup();
    const p = await service.create({ name: 'DeepSeek', kind: 'openai-compatible' });
    const withModel = await service.addModels(p.id, [{ modelId: 'deepseek-chat' }, { modelId: 'deepseek-reasoner' }]);
    await service.assignAgentModel('DEV', { model: 'deepseek-chat', providerId: p.id });

    await expect(service.remove(p.id)).rejects.toBeInstanceOf(ConflictException);
    await expect(service.update(p.id, { isEnabled: false })).rejects.toBeInstanceOf(ConflictException);
    const used = withModel.models.find(m => m.modelId === 'deepseek-chat')!;
    const unused = withModel.models.find(m => m.modelId === 'deepseek-reasoner')!;
    await expect(service.removeModel(p.id, used.id)).rejects.toBeInstanceOf(ConflictException);
    expect((await service.removeModel(p.id, unused.id)).models).toHaveLength(1);

    // Back on the env gateway, the provider is free again
    await service.assignAgentModel('DEV', { model: 'cx/gpt-5.4' });
    expect((await service.remove(p.id)).deleted).toBe(true);
  });

  it('offers the 9Router defaults while no provider is configured', async () => {
    const { service } = setup();
    const options = await service.modelOptions();
    expect(options.length).toBeGreaterThan(5);
    expect(options.every(o => o.providerId === null && o.provider === 'ninerouter')).toBe(true);
  });
});

describe('ConfiguredProviderRegistry', () => {
  const env = { ...process.env };
  afterEach(() => { process.env = { ...env }; });

  it('imports 9Router from the environment once and links agents on it', async () => {
    process.env.NINE_ROUTER_URL = 'http://localhost:20128/v1';
    process.env.NINE_ROUTER_API_KEY = 'nr-key-0001';
    const { registry, repo, agents, factory } = setup([
      { role: 'DEV', modelRouteConfig: { provider: 'ninerouter', model: 'my/custom-model' } },
      { role: 'QA', modelRouteConfig: { provider: 'anthropic-direct', model: 'claude' } },
    ]);
    await registry.onModuleInit();
    await registry.onModuleInit();

    const [nine] = await repo.findAll();
    expect(await repo.count()).toBe(1);
    expect(nine.name).toBe('9Router');
    expect(nine.connection(cipher).apiKey).toBe('nr-key-0001');
    expect(nine.findModel('my/custom-model')).toBeDefined();
    expect(agents[0].modelRouteConfig.providerId).toBe(nine.id);
    expect(agents[1].modelRouteConfig.providerId).toBeUndefined();
    expect(factory.getProvider(agents[0].modelRouteConfig)).toBeInstanceOf(FakeClient);
  });

  it('falls back to the env gateway when the configured provider is gone', () => {
    process.env.NINE_ROUTER_API_KEY = 'x';
    const { factory } = setup();
    expect(factory.getProvider({ provider: 'Old', providerId: 'missing', model: 'm' })).toBeInstanceOf(NineRouterProvider);
  });
});

/**
 * LlmProviderConfig
 *
 * An LLM provider configured from the web app: where to reach it (kind + base URL), the
 * credential to use, and the models agents may pick from it. The API key is held only in
 * encrypted form; `toView()` exposes its last four characters, never the key.
 *
 * @pattern Aggregate Root (owns its LlmModels), Factory Method
 */
import { randomUUID } from 'crypto';
import { LlmModel, LlmModelProps, LlmProviderError, ModelSource } from './LlmModel';
import { ProviderKind, isProviderKind } from './ProviderKind';
import { SecretCipher } from './SecretCipher';

export interface LlmProviderProps {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string | null;
  apiKeyEncrypted: string | null;
  apiKeyLast4: string | null;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

/** Decrypted connection details, handed to a ProviderStrategy; never leaves the server */
export interface ProviderConnection {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string | null;
  apiKey: string | null;
}

export class LlmProviderConfig {
  private constructor(private props: LlmProviderProps, private models: LlmModel[]) {}

  static create(
    params: { name: string; kind: string; baseUrl?: string | null; apiKey?: string | null; now?: Date },
    cipher: SecretCipher
  ): LlmProviderConfig {
    const now = params.now ?? new Date();
    const provider = new LlmProviderConfig(
      {
        id: randomUUID(),
        name: LlmProviderConfig.validName(params.name),
        kind: LlmProviderConfig.validKind(params.kind),
        baseUrl: LlmProviderConfig.validBaseUrl(params.baseUrl),
        apiKeyEncrypted: null,
        apiKeyLast4: null,
        isEnabled: true,
        createdAt: now,
        updatedAt: now,
      },
      []
    );
    if (params.apiKey) provider.setApiKey(params.apiKey, cipher);
    return provider;
  }

  static fromPersistence(props: LlmProviderProps, models: LlmModelProps[]): LlmProviderConfig {
    return new LlmProviderConfig({ ...props }, models.map(m => LlmModel.fromPersistence(m)));
  }

  private static validName(name: string): string {
    const trimmed = name?.trim();
    if (!trimmed || trimmed.length > 60) throw new LlmProviderError('Provider name must be 1-60 characters');
    return trimmed;
  }

  private static validKind(kind: string): ProviderKind {
    if (!isProviderKind(kind)) throw new LlmProviderError(`Unknown provider kind '${kind}'`);
    return kind;
  }

  private static validBaseUrl(baseUrl?: string | null): string | null {
    const trimmed = baseUrl?.trim();
    if (!trimmed) return null;
    let url: URL;
    try {
      url = new URL(trimmed);
    } catch {
      throw new LlmProviderError(`Invalid base URL '${trimmed}'`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new LlmProviderError('Base URL must be http or https');
    return trimmed.replace(/\/+$/, '');
  }

  update(
    changes: { name?: string; kind?: string; baseUrl?: string | null; apiKey?: string | null; isEnabled?: boolean },
    cipher: SecretCipher,
    now = new Date()
  ): void {
    if (changes.name !== undefined) this.props.name = LlmProviderConfig.validName(changes.name);
    if (changes.kind !== undefined) this.props.kind = LlmProviderConfig.validKind(changes.kind);
    if (changes.baseUrl !== undefined) this.props.baseUrl = LlmProviderConfig.validBaseUrl(changes.baseUrl);
    if (changes.isEnabled !== undefined) this.props.isEnabled = changes.isEnabled;
    // undefined or '' keeps the stored key; null removes it
    if (changes.apiKey === null) this.clearApiKey();
    else if (changes.apiKey) this.setApiKey(changes.apiKey, cipher);
    this.props.updatedAt = now;
  }

  private setApiKey(apiKey: string, cipher: SecretCipher): void {
    const key = apiKey.trim();
    if (key.length > 500) throw new LlmProviderError('API key is too long');
    this.props.apiKeyEncrypted = cipher.encrypt(key);
    this.props.apiKeyLast4 = key.slice(-4);
  }

  private clearApiKey(): void {
    this.props.apiKeyEncrypted = null;
    this.props.apiKeyLast4 = null;
  }

  // ---- Models ---------------------------------------------------------------

  addModel(params: { modelId: string; displayName?: string; category?: string; source?: ModelSource }): LlmModel {
    const modelId = params.modelId?.trim();
    if (this.findModel(modelId)) throw new LlmProviderError(`Model '${modelId}' already exists in ${this.props.name}`);
    const model = LlmModel.create({ id: randomUUID(), ...params });
    this.models.push(model);
    return model;
  }

  /** Adds the model ids not configured yet (as synced, enabled); returns how many were added */
  mergeSyncedModels(remote: Array<{ modelId: string; displayName?: string }>): number {
    let added = 0;
    for (const r of remote) {
      if (!r.modelId?.trim() || this.findModel(r.modelId.trim())) continue;
      this.addModel({ modelId: r.modelId, displayName: r.displayName, source: 'synced' });
      added++;
    }
    return added;
  }

  modelById(id: string): LlmModel {
    const model = this.models.find(m => m.id === id);
    if (!model) throw new LlmProviderError(`Model ${id} not found in ${this.props.name}`);
    return model;
  }

  removeModel(id: string): LlmModel {
    const model = this.modelById(id);
    this.models = this.models.filter(m => m.id !== id);
    return model;
  }

  findModel(modelId: string): LlmModel | undefined {
    return this.models.find(m => m.modelId === modelId);
  }

  // ---- Queries --------------------------------------------------------------

  get id() { return this.props.id; }
  get name() { return this.props.name; }
  get kind() { return this.props.kind; }
  get isEnabled() { return this.props.isEnabled; }
  get updatedAt() { return this.props.updatedAt; }

  enabledModels(): LlmModel[] {
    return this.models.filter(m => m.isEnabled);
  }

  connection(cipher: SecretCipher): ProviderConnection {
    return {
      id: this.props.id,
      name: this.props.name,
      kind: this.props.kind,
      baseUrl: this.props.baseUrl,
      apiKey: this.props.apiKeyEncrypted ? cipher.decrypt(this.props.apiKeyEncrypted) : null,
    };
  }

  toPrimitives(): { provider: LlmProviderProps; models: LlmModelProps[] } {
    return { provider: { ...this.props }, models: this.models.map(m => m.toPrimitives()) };
  }

  /** What the API returns: the key only as a hint */
  toView() {
    const { apiKeyEncrypted, apiKeyLast4, ...rest } = this.props;
    return {
      ...rest,
      hasApiKey: !!apiKeyEncrypted,
      apiKeyHint: apiKeyLast4 ? `••••${apiKeyLast4}` : null,
      models: this.models.map(m => m.toPrimitives()),
    };
  }
}

export interface ILlmProviderRepository {
  save(provider: LlmProviderConfig): Promise<void>;
  findById(id: string): Promise<LlmProviderConfig | null>;
  findByName(name: string): Promise<LlmProviderConfig | null>;
  findAll(): Promise<LlmProviderConfig[]>;
  delete(id: string): Promise<void>;
  count(): Promise<number>;
}

export const LLM_PROVIDER_REPOSITORY = Symbol('ILlmProviderRepository');

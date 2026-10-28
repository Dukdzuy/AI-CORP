/**
 * LlmModel
 *
 * A model offered by a configured provider, identified by the id the provider expects in
 * requests (e.g. `gpt-4o`, `openrouter/google/gemma-4-31b-it:free`). Added by hand or
 * synced from the provider's model list.
 *
 * @pattern Entity (part of the LlmProviderConfig aggregate)
 */
export type ModelSource = 'manual' | 'synced';

export const MODEL_CATEGORIES = ['general', 'code', 'reasoning', 'premium'] as const;

export interface LlmModelProps {
  id: string;
  modelId: string;
  displayName: string;
  category: string;
  isEnabled: boolean;
  source: ModelSource;
  createdAt: Date;
}

export class LlmModel {
  private constructor(private props: LlmModelProps) {}

  static create(params: { id: string; modelId: string; displayName?: string; category?: string; source?: ModelSource; now?: Date }): LlmModel {
    const modelId = params.modelId?.trim();
    if (!modelId || modelId.length > 200) throw new LlmProviderError('Model id must be 1-200 characters');
    const category = params.category?.trim() || 'general';
    return new LlmModel({
      id: params.id,
      modelId,
      displayName: params.displayName?.trim() || modelId,
      category,
      isEnabled: true,
      source: params.source ?? 'manual',
      createdAt: params.now ?? new Date(),
    });
  }

  static fromPersistence(props: LlmModelProps): LlmModel {
    return new LlmModel({ ...props });
  }

  update(changes: { displayName?: string; category?: string; isEnabled?: boolean }): void {
    this.props = {
      ...this.props,
      ...(changes.displayName !== undefined && { displayName: changes.displayName.trim() || this.props.modelId }),
      ...(changes.category !== undefined && { category: changes.category.trim() || 'general' }),
      ...(changes.isEnabled !== undefined && { isEnabled: changes.isEnabled }),
    };
  }

  get id() { return this.props.id; }
  get modelId() { return this.props.modelId; }
  get isEnabled() { return this.props.isEnabled; }

  toPrimitives(): LlmModelProps {
    return { ...this.props };
  }
}

export class LlmProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LlmProviderError';
  }
}

import { ILLMProvider } from '@ai-corp/shared-types';
import { ProviderConnection, ProviderKind } from '../../../domain/llm';

export interface RemoteModel {
  modelId: string;
  displayName?: string;
}

/**
 * How to talk to one kind of provider: build its chat client and list its models.
 * A new kind is a new strategy class plus one line in ProviderStrategyRegistry.
 *
 * @pattern Strategy
 */
export interface ProviderStrategy {
  readonly kind: ProviderKind;
  readonly defaultBaseUrl: string;
  createClient(connection: ProviderConnection): ILLMProvider;
  listModels(connection: ProviderConnection): Promise<RemoteModel[]>;
}

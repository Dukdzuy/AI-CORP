import { Injectable } from '@nestjs/common';
import { ProviderKind } from '../../../domain/llm';
import { AnthropicStrategy } from './anthropic.strategy';
import { OpenAICompatibleStrategy } from './openai-compatible.strategy';
import { ProviderStrategy } from './provider-strategy';

/**
 * Picks the ProviderStrategy for a provider kind.
 *
 * @pattern Registry, Open/Closed
 */
@Injectable()
export class ProviderStrategyRegistry {
  private readonly strategies: Map<ProviderKind, ProviderStrategy>;

  constructor(openAI: OpenAICompatibleStrategy, anthropic: AnthropicStrategy) {
    this.strategies = new Map<ProviderKind, ProviderStrategy>([openAI, anthropic].map(s => [s.kind, s]));
  }

  for(kind: ProviderKind): ProviderStrategy {
    const strategy = this.strategies.get(kind);
    if (!strategy) throw new Error(`No strategy for provider kind '${kind}'`);
    return strategy;
  }

  kinds(): Array<{ kind: ProviderKind; defaultBaseUrl: string }> {
    return [...this.strategies.values()].map(s => ({ kind: s.kind, defaultBaseUrl: s.defaultBaseUrl }));
  }
}

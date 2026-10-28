/**
 * ProviderKind
 *
 * The wire protocol a configured LLM provider speaks. Each kind has one strategy that
 * builds its client and lists its models (see ProviderStrategyRegistry). 9Router, OpenAI,
 * OpenRouter, Groq, DeepSeek and Ollama all speak the OpenAI protocol.
 *
 * @pattern Value Object
 */
export enum ProviderKind {
  OPENAI_COMPATIBLE = 'openai-compatible',
  ANTHROPIC = 'anthropic',
}

export const PROVIDER_KINDS = Object.values(ProviderKind) as string[];

export function isProviderKind(value: unknown): value is ProviderKind {
  return typeof value === 'string' && PROVIDER_KINDS.includes(value);
}

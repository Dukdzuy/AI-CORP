import { Injectable, Logger } from '@nestjs/common';
import {
  ILLMProvider,
  ModelRouteConfig,
  ChatParams,
  ChatResult,
} from '@ai-corp/shared-types';
import { AnthropicDirectProvider } from './anthropic-direct.provider';
import { NineRouterProvider } from './nine-router-provider';
import { NineRouterHealthService } from './nine-router-health.service';

/**
 * LLMProviderFactory
 *
 * Factory class responsible for selecting and instantiating the appropriate LLM provider
 * based on configuration and health status.
 *
 * Implements the factory pattern to:
 * - Route requests to 9Router when available
 * - Fallback to direct providers when 9Router is unavailable
 * - Hide provider-specific implementation details from consumers
 * - Enable easy addition of new providers
 */
@Injectable()
export class LLMProviderFactory {
  private readonly logger = new Logger(LLMProviderFactory.name);
  private providers: Map<string, ILLMProvider> = new Map();

  constructor(private readonly healthService?: NineRouterHealthService) {}

  /**
   * Get the appropriate LLM provider based on configuration
   *
   * @param config - ModelRouteConfig specifying which provider(s) to use
   * @returns The selected ILLMProvider instance
   *
   * @throws Error if provider cannot be instantiated or configuration is invalid
   *
   * Routing logic:
   * 1. If provider is "ninerouter", return NineRouterProvider
   * 2. If provider is "anthropic-direct", return AnthropicDirectProvider
   * 3. Fallback provider is stored in config.fallbackProvider for circuit breaker use
   */
  getProvider(config: ModelRouteConfig): ILLMProvider {
    let provider = config.provider || 'opencode';
    
    // Fallback routing if circuit breaker is open
    if ((provider === 'ninerouter' || provider === 'opencode') && this.healthService?.getIsCircuitOpen()) {
      this.logger.warn(
        `Circuit breaker is OPEN. Routing from ${provider} to fallback: ${config.fallbackProvider || 'opencode'}`,
      );
      provider = config.fallbackProvider || 'opencode';
    }

    const providerKey = this.getProviderKey(provider, config.model);

    // Check if provider is already instantiated and cached
    if (this.providers.has(providerKey)) {
      return this.providers.get(providerKey)!;
    }

    // Instantiate new provider based on configuration
    let llmProvider: ILLMProvider;

    switch (provider) {
      case 'ninerouter':
      case 'opencode':
        llmProvider = this.createOpenCodeProvider(config.model);
        break;
      case 'anthropic-direct':
        llmProvider = this.createAnthropicDirectProvider();
        break;
      default:
        this.logger.warn(
          `Unknown provider: ${provider}, defaulting to opencode`,
        );
        llmProvider = this.createOpenCodeProvider(config.model);
    }

    // Cache the provider instance
    this.providers.set(providerKey, llmProvider);

    return llmProvider;
  }

  /**
   * Create an OpenCode/9Router provider instance (OpenAI-compatible)
   * @param model - Model identifier
   * @returns NineRouterProvider configured with environment settings
   */
  private createOpenCodeProvider(model?: string): ILLMProvider {
    const baseURL = process.env.NINE_ROUTER_URL || 'http://localhost:20128/v1';
    const apiKey = process.env.NINE_ROUTER_API_KEY || '';

    return new NineRouterProvider(baseURL, apiKey);
  }

  /**
   * Create an AnthropicDirectProvider instance
   * @returns AnthropicDirectProvider configured with environment settings
   */
  private createAnthropicDirectProvider(): ILLMProvider {
    return new AnthropicDirectProvider();
  }

  /**
   * Generate a cache key for provider instances
   * @param provider - Provider name
   * @param model - Model identifier
   * @returns Cache key
   */
  private getProviderKey(provider: string, model: string): string {
    return `${provider}:${model}`;
  }

  /**
   * Clear cached providers (useful for testing or reconfiguration)
   */
  clearCache(): void {
    this.providers.clear();
    this.logger.debug('Provider cache cleared');
  }
}

import { Logger } from '@nestjs/common';
import { OpenAI } from 'openai';
import {
  ILLMProvider,
  ChatParams,
  ChatResult,
} from '@ai-corp/shared-types';

/**
 * NineRouterProvider
 *
 * Implements ILLMProvider for 9Router LLM gateway.
 *
 * 9Router provides:
 * - 3-tier auto-fallback (subscription → cheap → free APIs)
 * - RTK Token Saver technology reducing input tokens by 20-40%
 * - Unified OpenAI-compatible API interface
 *
 * Configuration:
 * - NINE_ROUTER_URL: Base URL to 9Router gateway (default: http://localhost:20128/v1)
 * - NINE_ROUTER_API_KEY: API key for authentication with 9Router
 */
export class NineRouterProvider implements ILLMProvider {
  private readonly logger = new Logger(NineRouterProvider.name);
  private client: OpenAI;
  private readonly MAX_RETRIES = 3;
  private readonly RETRY_BASE_DELAY_MS = 1000;

  constructor(baseURL: string, apiKey: string) {
    if (!baseURL) {
      throw new Error('NINE_ROUTER_URL environment variable is not set');
    }
    if (!apiKey) {
      throw new Error('NINE_ROUTER_API_KEY environment variable is not set');
    }

    this.logger.debug(`Initializing NineRouterProvider with baseURL: ${baseURL}`);

    // Initialize OpenAI client configured for 9Router endpoint
    this.client = new OpenAI({
      baseURL: baseURL,
      apiKey: apiKey,
      // Set a reasonable timeout for API calls
      timeout: 60000,
    });
  }

  /**
   * Send a chat request to 9Router
   *
   * @param params - Chat request parameters
   * @returns ChatResult with response content and metadata
   *
   * Extracts from 9Router response:
   * - actualModelUsed: The actual model that processed the request (may differ from requested)
   * - actualProvider: The provider that was used (openai, anthropic, etc.)
   * - rtkTokenSaved: Number of tokens saved by RTK compression
   */
  async chat(params: ChatParams): Promise<ChatResult> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const delay = this.RETRY_BASE_DELAY_MS * Math.pow(2, attempt - 1);
          this.logger.log(`Retry attempt ${attempt}/${this.MAX_RETRIES} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }

        this.logger.debug(
          `Sending chat request to 9Router: model=${params.model}, messageCount=${params.messages.length}`,
        );

        // Call 9Router API using OpenAI client
        const response = await this.client.chat.completions.create({
          model: params.model,
          messages: params.messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens,
          tools: params.tools as any, // OpenAI tools format
        });

        this.logger.debug(
          `Received response from 9Router: actual_model=${response.model}, usage=${JSON.stringify(response.usage)}`,
        );

      // Extract actual model used - 9Router returns this in the response.model field
      const actualModelUsed = response.model || params.model;

      // Extract RTK tokens saved from response headers (if available)
      // 9Router may include this in the response headers or in custom fields
      let rtkTokenSaved: number | undefined;

      // Try to extract from response headers (if exposed by OpenAI client)
      // In 9Router, this might be in headers or custom fields
      if ((response as any).headers) {
        const rtkHeader = (response as any).headers['x-rtk-tokens-saved'];
        if (rtkHeader) {
          rtkTokenSaved = parseInt(rtkHeader, 10);
        }
      }

      // Alternative: check if 9Router includes it in the response body
      if ((response as any).rtk_tokens_saved) {
        rtkTokenSaved = (response as any).rtk_tokens_saved;
      }

      // Extract actual provider from response
      // 9Router may return this in headers or in the response
      let actualProvider = 'ninerouter';
      if ((response as any).headers) {
        const providerHeader = (response as any).headers['x-provider'];
        if (providerHeader) {
          actualProvider = providerHeader;
        }
      }
      if ((response as any).provider) {
        actualProvider = (response as any).provider;
      }

      // Check if the response used a different model than requested (fallback triggered)
      const isFallbackTriggered = actualModelUsed !== params.model;

      // Extract first message content
      const content = response.choices[0]?.message?.content || '';

      // Build result object
      const result: ChatResult = {
        content,
        requestedModel: params.model,
        actualModelUsed,
        actualProvider,
        isFallbackTriggered,
        tokenUsage: {
          promptTokens: response.usage?.prompt_tokens || 0,
          completionTokens: response.usage?.completion_tokens || 0,
          totalTokens: response.usage?.total_tokens || 0,
        },
        rtkTokenSaved,
        toolCalls: response.choices[0]?.message?.tool_calls as any,
      };

      this.logger.log(
        `Chat completed: model=${actualModelUsed}, provider=${actualProvider}, tokens=${result.tokenUsage.totalTokens}, rtkSaved=${rtkTokenSaved}`,
      );

      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const errorMessage = lastError.message;

      // Check if error is retryable (transient)
      const isRetryable = this.isRetryableError(errorMessage);

      if (isRetryable && attempt < this.MAX_RETRIES) {
        this.logger.warn(
          `Retryable error on attempt ${attempt + 1}: ${errorMessage}`,
        );
        continue; // Retry
      }

      // Non-retryable or max retries exhausted
      this.logger.error(
        `Failed to call 9Router after ${attempt + 1} attempts: ${errorMessage}`,
        lastError.stack,
      );

      // Provide detailed error context for debugging
      if (errorMessage.includes('401') || errorMessage.includes('Unauthorized')) {
        this.logger.error(
          'Authentication failed - check NINE_ROUTER_API_KEY configuration',
        );
      } else if (errorMessage.includes('404')) {
        this.logger.error(
          'Endpoint not found - check NINE_ROUTER_URL configuration',
        );
      } else if (errorMessage.includes('connection') || errorMessage.includes('ECONNREFUSED')) {
        this.logger.error(
          '9Router is unreachable - check if service is running and accessible',
        );
      }

      throw lastError;
    }
    }

    // This should never be reached, but TypeScript requires it
    throw lastError || new Error('Unknown error');
  }

  /**
   * Check if an error is retryable (transient)
   */
  private isRetryableError(errorMessage: string): boolean {
    // Rate limit errors - retry with backoff
    if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
      return true;
    }
    // Connection errors - transient
    if (errorMessage.includes('ECONNREFUSED') || errorMessage.includes('ETIMEDOUT') ||
        errorMessage.includes('connection') || errorMessage.includes(' network')) {
      return true;
    }
    // Server errors (5xx) - transient
    if (errorMessage.includes('500') || errorMessage.includes('502') ||
        errorMessage.includes('503') || errorMessage.includes('504')) {
      return true;
    }
    return false;
  }

  /**
   * Validate that 9Router is properly configured
   *
   * @returns true if configuration is valid and provider can be used
   */
  async validateConfig(): Promise<boolean> {
    try {
      this.logger.debug('Validating NineRouterProvider configuration...');

      // Make a simple test request to verify connectivity and credentials
      await this.client.models.list();

      this.logger.log('NineRouterProvider configuration validated successfully');
      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error(`NineRouterProvider configuration validation failed: ${errorMessage}`);
      return false;
    }
  }

  /**
   * Get the provider name
   * @returns 'ninerouter'
   */
  getProviderName(): string {
    return 'ninerouter';
  }
}

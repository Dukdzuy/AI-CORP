import { Injectable, Logger } from '@nestjs/common';
import { Anthropic } from '@anthropic-ai/sdk';
import {
  ILLMProvider,
  ChatParams,
  ChatResult,
  TokenUsage,
} from '@ai-corp/shared-types';

/**
 * AnthropicDirectProvider
 *
 * Implements ILLMProvider for direct Anthropic API access.
 *
 * This provider serves as the fallback when 9Router is unavailable or the circuit
 * breaker is open. It communicates directly with Anthropic's API without going through
 * the 9Router gateway.
 *
 * Key responsibilities:
 * - Initialize Anthropic SDK client with API key from environment
 * - Translate chat parameters to Anthropic API format
 * - Make API calls to Claude models
 * - Parse responses and extract token usage information
 * - Track which model was actually used (always Anthropic)
 * - Return ChatResult matching ILLMProvider interface
 *
 * Configuration:
 * - Reads ANTHROPIC_API_KEY from environment variables
 * - Validates API key on initialization
 *
 * Token Tracking:
 * - Records actual token usage from Anthropic API responses
 * - rtkTokenSaved is not applicable (direct API, no compression)
 * - isFallbackTriggered is set based on routing context (handled by caller)
 */
@Injectable()
export class AnthropicDirectProvider implements ILLMProvider {
  private readonly logger = new Logger(AnthropicDirectProvider.name);
  private readonly anthropic: Anthropic;
  private readonly apiKey: string;

  constructor() {
    this.apiKey = process.env.ANTHROPIC_API_KEY || '';

    if (!this.apiKey) {
      this.logger.warn(
        'ANTHROPIC_API_KEY not set in environment variables. ' +
          'This provider will fail at runtime.',
      );
    }

    // Initialize Anthropic SDK client
    this.anthropic = new Anthropic({
      apiKey: this.apiKey,
    });
  }

  /**
   * Send a chat request to Claude via direct Anthropic API
   *
   * @param params - ChatParams containing model, messages, and optional parameters
   * @returns ChatResult with actual model used, token usage, and content
   *
   * @throws Error if API call fails or API key is not configured
   *
   * Implementation details:
   * - Maps ChatParams.messages to Anthropic format
   * - Calls anthropic.messages.create() with appropriate parameters
   * - Extracts token usage from response
   * - Maps response content to ChatResult
   * - Handles tool calls if present
   * - Always returns actualProvider as "anthropic"
   * - Calculates costs based on token pricing
   */
  async chat(params: ChatParams): Promise<ChatResult> {
    if (!this.apiKey) {
      throw new Error(
        'ANTHROPIC_API_KEY is not configured. Cannot make API calls to Anthropic.',
      );
    }

    try {
      this.logger.debug(
        `Calling Anthropic API with model: ${params.model}, messages: ${params.messages.length}`,
      );

      // Extract parameters with defaults
      const model = params.model || 'claude-opus';
      const temperature = params.temperature ?? 0.7;
      const maxTokens = params.maxTokens ?? 2048;

      // Call Anthropic API
      const response = await (this.anthropic as any).messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: this.extractSystemMessage(params.messages),
        messages: this.filterMessages(params.messages),
      });

      // Extract content from response
      const contentBlock = response.content[0];
      let content = '';
      let toolCalls: any[] = [];

      if (contentBlock.type === 'text') {
        content = contentBlock.text;
      } else if (contentBlock.type === 'tool_use') {
        // Handle tool use if present
        toolCalls = [
          {
            id: contentBlock.id,
            function: {
              name: contentBlock.name,
              arguments: JSON.stringify(contentBlock.input),
            },
          },
        ];
        content = `Tool call: ${contentBlock.name}`;
      }

      // Extract token usage from response
      const tokenUsage: TokenUsage = {
        promptTokens: response.usage.input_tokens,
        completionTokens: response.usage.output_tokens,
        totalTokens:
          response.usage.input_tokens + response.usage.output_tokens,
      };

      this.logger.debug(
        `Anthropic API call completed. Tokens: ${tokenUsage.totalTokens}`,
      );

      // Build ChatResult
      const result: ChatResult = {
        content,
        requestedModel: params.model,
        actualModelUsed: model,
        actualProvider: 'anthropic',
        isFallbackTriggered: false, // Will be set by caller if this is a fallback
        tokenUsage,
        rtkTokenSaved: undefined, // Direct API calls don't have RTK compression
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      };

      return result;
    } catch (error) {
      this.logger.error(
        `Anthropic API call failed: ${error instanceof Error ? error.message : String(error)}`,
      );

      throw new Error(
        `Anthropic API error: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Validate that the Anthropic configuration is working
   *
   * @returns true if API key is configured and provider is ready, false otherwise
   */
  async validateConfig(): Promise<boolean> {
    if (!this.apiKey) {
      this.logger.warn('ANTHROPIC_API_KEY is not configured');
      return false;
    }

    try {
      // Attempt a simple API call to verify credentials
      const response = await (this.anthropic as any).messages.create({
        model: 'claude-opus',
        max_tokens: 10,
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
      });

      this.logger.debug('Anthropic configuration validated successfully');
      return true;
    } catch (error) {
      this.logger.error(
        `Anthropic configuration validation failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }

  /**
   * Get the provider name
   *
   * @returns Provider name as "anthropic-direct"
   */
  getProviderName(): string {
    return 'anthropic-direct';
  }

  /**
   * Extract system message from chat messages
   *
   * Anthropic API requires system message to be passed separately,
   * not as part of the messages array.
   *
   * @param messages - Array of ChatMessages
   * @returns System message content or empty string if not found
   */
  private extractSystemMessage(messages: any[]): string {
    const systemMessage = messages.find((m) => m.role === 'system');
    return systemMessage ? systemMessage.content : '';
  }

  /**
   * Filter messages to exclude system message
   *
   * Anthropic API doesn't allow system messages in the messages array,
   * so we filter them out and handle separately.
   *
   * @param messages - Array of ChatMessages
   * @returns Messages array without system message
   */
  private filterMessages(messages: any[]): any[] {
    return messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));
  }
}

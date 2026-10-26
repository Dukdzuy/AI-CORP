import { Logger } from '@nestjs/common';
import { ChatParams, ChatResult, ILLMProvider } from '@ai-corp/shared-types';
import { ApiUsageService } from './api-usage.service';

export interface UsageContext {
  agentRole: string;
  projectId?: string;
}

/**
 * UsageTrackingLLMProvider
 *
 * Decorator over any ILLMProvider: forwards the call unchanged, then records tokens
 * and cost through ApiUsageService (which also accrues the project's cost and enforces
 * its budget). Agents get cost tracking without each strategy calling ApiUsageService.
 *
 * @pattern Decorator
 */
export class UsageTrackingLLMProvider implements ILLMProvider {
  private readonly logger = new Logger(UsageTrackingLLMProvider.name);

  constructor(
    private readonly inner: ILLMProvider,
    private readonly apiUsageService: ApiUsageService,
    private readonly usage: UsageContext
  ) {}

  async chat(params: ChatParams): Promise<ChatResult> {
    const startTime = Date.now();
    const result = await this.inner.chat(params);

    await this.apiUsageService
      .logUsage({
        projectId: this.usage.projectId,
        agentRole: this.usage.agentRole,
        requestedModel: params.model,
        actualModelUsed: result.actualModelUsed,
        actualProvider: result.actualProvider,
        isFallbackTriggered: result.isFallbackTriggered,
        promptTokens: result.tokenUsage?.promptTokens ?? 0,
        completionTokens: result.tokenUsage?.completionTokens ?? 0,
        rtkTokenSaved: result.rtkTokenSaved,
        responseTimeMs: Date.now() - startTime,
      })
      .catch(err => this.logger.warn(`Failed to log LLM usage: ${(err as Error).message}`));

    return result;
  }

  validateConfig(): Promise<boolean> {
    return this.inner.validateConfig();
  }

  getProviderName(): string {
    return this.inner.getProviderName();
  }
}

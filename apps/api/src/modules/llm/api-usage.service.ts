import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { WebSocketEventType } from '@ai-corp/shared-types';
import { EventBus } from '../../domain/events/EventBus';
import { BudgetExceededEvent } from '../../domain/events/BudgetExceededEvent';

export interface LogUsageParams {
  projectId?: string;
  agentRole: string;
  requestedModel: string;
  actualModelUsed: string;
  actualProvider: string;
  isFallbackTriggered?: boolean;
  promptTokens: number;
  completionTokens: number;
  rtkTokenSaved?: number;
  responseTimeMs: number;
}

/**
 * ApiUsageService
 * Tracks LLM token usage and calculates costs.
 */
@Injectable()
export class ApiUsageService {
  private readonly logger = new Logger(ApiUsageService.name);

  // Pricing per 1k tokens (in USD)
  private readonly MODEL_PRICING: Record<string, { prompt: number; completion: number }> = {
    'claude-opus': { prompt: 0.015, completion: 0.075 },
    'claude-sonnet-4': { prompt: 0.003, completion: 0.015 },
    'claude-haiku': { prompt: 0.00025, completion: 0.00125 },
    'gpt-4-turbo': { prompt: 0.01, completion: 0.03 },
    'gpt-3.5-turbo': { prompt: 0.0005, completion: 0.0015 },
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly eventBus: EventBus,
  ) {}

  /**
   * Adds the cost to the project in one atomic increment (parallel nodes call this at the same
   * time; a read-then-write lost updates) and reports each budget threshold once, when crossed:
   * 90% warns, 100% pauses the project and raises BudgetExceededEvent (its handler pauses the run;
   * the engine also refuses to start another node while the budget stays used up).
   */
  private async accrueProjectCost(projectId: string, cost: number): Promise<void> {
    const project = await this.prisma.project.update({
      where: { id: projectId },
      data: { costAccrued: { increment: cost } },
      select: { budget: true, costAccrued: true, status: true },
    }).catch(() => null);
    if (!project || project.budget === null) return;

    const budget = Number(project.budget);
    const after = Number(project.costAccrued);
    const before = after - cost;

    if (before < budget && after >= budget) {
      await this.eventBus
        .publish(new BudgetExceededEvent(projectId, after, budget))
        .catch(err => this.logger.error(`Failed to publish BudgetExceededEvent: ${err.message}`));
      if (project.status === 'active') {
        await this.prisma.project.update({ where: { id: projectId }, data: { status: 'paused' } });
      }
      this.websocketGateway.sendToProject(projectId, {
        type: WebSocketEventType.SYSTEM_NOTIFICATION,
        data: {
          message: `Project paused: Cost ($${after.toFixed(2)}) has exceeded the budget ($${budget.toFixed(2)}).`,
          level: 'critical',
        },
        timestamp: new Date()
      } as any);
    } else if (before < budget * 0.9 && after >= budget * 0.9 && after < budget) {
      this.websocketGateway.sendToProject(projectId, {
        type: WebSocketEventType.SYSTEM_NOTIFICATION,
        data: {
          message: `Warning: Cost ($${after.toFixed(2)}) has reached 90% of the budget ($${budget.toFixed(2)}).`,
          level: 'warning',
        },
        timestamp: new Date()
      } as any);
    }
  }

  async logUsage(params: LogUsageParams): Promise<void> {
    try {
      const totalTokens = params.promptTokens + params.completionTokens;
      
      const estimatedCost = this.calculateCost(params.requestedModel, params.promptTokens, params.completionTokens);
      const actualCost = this.calculateCost(params.actualModelUsed, params.promptTokens, params.completionTokens);

      await this.prisma.apiUsageLog.create({
        data: {
          projectId: params.projectId,
          agentRole: params.agentRole,
          requestedModel: params.requestedModel,
          actualModelUsed: params.actualModelUsed,
          actualProvider: params.actualProvider,
          isFallbackTriggered: params.isFallbackTriggered ?? false,
          promptTokens: params.promptTokens,
          completionTokens: params.completionTokens,
          totalTokens,
          rtkTokenSaved: params.rtkTokenSaved,
          estimatedCost,
          actualCost,
          responseTimeMs: params.responseTimeMs,
        },
      });

      this.logger.debug(
        `Logged API usage for ${params.agentRole}: ${totalTokens} tokens, Cost: $${actualCost.toFixed(6)}`
      );

      if (params.projectId && actualCost > 0) {
        await this.accrueProjectCost(params.projectId, actualCost);
      }
    } catch (error) {
      this.logger.error(`Failed to log API usage: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private calculateCost(model: string, promptTokens: number, completionTokens: number): number {
    const pricing = this.MODEL_PRICING[model.toLowerCase()] || { prompt: 0, completion: 0 };
    const promptCost = (promptTokens / 1000) * pricing.prompt;
    const completionCost = (completionTokens / 1000) * pricing.completion;
    return promptCost + completionCost;
  }
}

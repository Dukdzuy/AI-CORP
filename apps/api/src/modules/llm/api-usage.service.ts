import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { WebSocketEventType } from '@ai-corp/shared-types';

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
  ) {}

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
        const project = await this.prisma.project.findUnique({ where: { id: params.projectId } });
        if (project) {
          const newCost = Number(project.costAccrued) + actualCost;
          
          await this.prisma.project.update({
            where: { id: params.projectId },
            data: { costAccrued: newCost },
          });

          if (project.budget) {
            const budget = Number(project.budget);
            if (newCost >= budget) {
              await this.prisma.project.update({
                where: { id: params.projectId },
                data: { status: 'paused' },
              });
              
              this.websocketGateway.sendToProject(params.projectId, {
                type: WebSocketEventType.SYSTEM_NOTIFICATION,
                data: {
                  message: `Project paused: Cost ($${newCost.toFixed(2)}) has exceeded the budget ($${budget.toFixed(2)}).`,
                  level: 'critical',
                },
                timestamp: new Date()
              } as any);
            } else if (newCost >= budget * 0.9) {
              this.websocketGateway.sendToProject(params.projectId, {
                type: WebSocketEventType.SYSTEM_NOTIFICATION,
                data: {
                  message: `Warning: Cost ($${newCost.toFixed(2)}) has reached 90% of the budget ($${budget.toFixed(2)}).`,
                  level: 'warning',
                },
                timestamp: new Date()
              } as any);
            }
          }
        }
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

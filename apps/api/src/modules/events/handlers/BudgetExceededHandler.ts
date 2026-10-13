/**
 * Budget Exceeded Handler
 * 
 * Handles the BudgetExceededEvent by:
 * 1. Pausing the project's workflow
 * 2. Sending WebSocket notification to project room
 * 
 * Business Rule: When budget is exceeded, automatically pause workflow
 * and alert the user so they can decide whether to increase budget or stop.
 * 
 * @pattern Observer Pattern - implements IEventHandler
 */

import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../../domain/events/EventBus';
import { BudgetExceededEvent } from '../../../domain/events';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class BudgetExceededHandler implements IEventHandler<BudgetExceededEvent> {
  private readonly logger = new Logger(BudgetExceededHandler.name);

  constructor(
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly prisma: PrismaService
  ) {}

  async handle(event: BudgetExceededEvent): Promise<void> {
    this.logger.warn(
      `Budget exceeded for project ${event.projectId}: $${event.currentCost} > $${event.budget}`
    );

    try {
      // Find the active workflow run for this project
      const activeRun = await this.prisma.workflowRun.findFirst({
        where: {
          projectId: event.projectId,
          status: 'running'
        },
        orderBy: { createdAt: 'desc' }
      });

      if (activeRun) {
        // Pause the workflow
        await this.prisma.workflowRun.update({
          where: { id: activeRun.id },
          data: { status: 'paused' }
        });

        this.logger.log(`Paused workflow run ${activeRun.id} due to budget exceeded`);
      }

      // Send WebSocket notification to project room
      this.websocketGateway.sendToProject(event.projectId, {
        type: 'system_notification',
        data: {
          severity: 'warning',
          message: `Project budget exceeded: $${event.currentCost.toFixed(2)} of $${event.budget.toFixed(2)}. Workflow paused.`,
          timestamp: event.occurredOn,
          eventId: event.eventId
        }
      });

      this.logger.log(`Budget exceeded notification sent to project ${event.projectId}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle budget exceeded event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      throw error;
    }
  }
}

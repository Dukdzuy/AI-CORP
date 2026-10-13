/**
 * Agent Completed Task Handler
 * 
 * Handles the AgentCompletedTaskEvent by:
 * 1. Updating task status in database (if applicable)
 * 2. Sending WebSocket notification for UI update
 * 
 * @pattern Observer Pattern - implements IEventHandler
 */

import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../../domain/events/EventBus';
import { AgentCompletedTaskEvent } from '../../../domain/events';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class AgentCompletedTaskHandler implements IEventHandler<AgentCompletedTaskEvent> {
  private readonly logger = new Logger(AgentCompletedTaskHandler.name);

  constructor(
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly prisma: PrismaService
  ) {}

  async handle(event: AgentCompletedTaskEvent): Promise<void> {
    this.logger.log(
      `Agent ${event.agentId} completed task ${event.taskId} for project ${event.projectId}`
    );

    try {
      // Try to find the task in the database
      const task = await this.prisma.task.findFirst({
        where: {
          id: event.taskId,
          projectId: event.projectId
        }
      });

      if (task && task.status === 'in_progress') {
        // Update task status based on agent role
        let newStatus = task.status;
        
        if (event.agentId === 'DEV') {
          newStatus = 'review'; // Dev completion → review
        } else if (event.agentId === 'QA' && event.result?.approved !== false) {
          newStatus = 'done'; // QA approval → done
        }

        if (newStatus !== task.status) {
          await this.prisma.task.update({
            where: { id: task.id },
            data: { status: newStatus }
          });

          this.logger.log(`Updated task ${task.id} status: ${task.status} → ${newStatus}`);
        }
      }

      // Send WebSocket notification for UI update
      this.websocketGateway.sendToProject(event.projectId, {
        type: 'agent:task_completed',
        data: {
          agentId: event.agentId,
          taskId: event.taskId,
          result: event.result,
          timestamp: event.occurredOn
        }
      });

      this.logger.log(`Agent task completion event sent to project ${event.projectId}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle agent completed task event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      // Don't re-throw - this is a non-critical handler
    }
  }
}

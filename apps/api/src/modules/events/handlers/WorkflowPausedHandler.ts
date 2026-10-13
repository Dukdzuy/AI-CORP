/**
 * Workflow Paused Handler
 * 
 * Handles the WorkflowPausedEvent by:
 * 1. Sending WebSocket notification to project room
 * 2. Logging the pause event for audit trail
 * 
 * @pattern Observer Pattern - implements IEventHandler
 */

import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../../domain/events/EventBus';
import { WorkflowPausedEvent } from '../../../domain/events';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';

@Injectable()
export class WorkflowPausedHandler implements IEventHandler<WorkflowPausedEvent> {
  private readonly logger = new Logger(WorkflowPausedHandler.name);

  constructor(
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async handle(event: WorkflowPausedEvent): Promise<void> {
    this.logger.log(`Workflow paused for project ${event.projectId}: ${event.reason}`);

    try {
      // Send WebSocket notification to project room
      this.websocketGateway.sendToProject(event.projectId, {
        type: 'system_notification',
        data: {
          severity: 'info',
          message: `Workflow paused: ${event.reason}`,
          timestamp: event.occurredOn,
          eventId: event.eventId
        }
      });

      this.logger.log(`Workflow paused notification sent to project ${event.projectId}`);
    } catch (error) {
      this.logger.error(
        `Failed to handle workflow paused event: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined
      );
      // Don't re-throw - this is a notification handler
    }
  }
}

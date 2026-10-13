/**
 * Notification Handler
 * 
 * Handles domain events by logging them to console.
 * This is a placeholder implementation - in production, this would:
 * - Send email notifications
 * - Push notifications to mobile devices
 * - Trigger Slack/Teams messages
 * - Send SMS alerts
 * 
 * @pattern Observer Pattern, Strategy Pattern
 * @principle Single Responsibility - only handles notifications
 */

import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../../domain/events/EventBus';
import { DomainEvent } from '../../../domain/events/DomainEvent';
import {
  ProjectCreatedEvent,
  TaskAssignedEvent,
  TaskCompletedEvent,
  WorkflowStartedEvent,
  WorkflowCompletedEvent,
  ApprovalRequestedEvent
} from '../../../domain/events';

@Injectable()
export class NotificationHandler implements IEventHandler {
  private readonly logger = new Logger(NotificationHandler.name);

  async handle(event: DomainEvent): Promise<void> {
    // Route to specific notification logic based on event type
    switch (event.eventType) {
      case 'project.created':
        await this.handleProjectCreated(event as ProjectCreatedEvent);
        break;
      case 'task.assigned':
        await this.handleTaskAssigned(event as TaskAssignedEvent);
        break;
      case 'task.completed':
        await this.handleTaskCompleted(event as TaskCompletedEvent);
        break;
      case 'workflow.started':
        await this.handleWorkflowStarted(event as WorkflowStartedEvent);
        break;
      case 'workflow.completed':
        await this.handleWorkflowCompleted(event as WorkflowCompletedEvent);
        break;
      case 'approval.requested':
        await this.handleApprovalRequested(event as ApprovalRequestedEvent);
        break;
      default:
        this.logger.debug(`No notification logic for event type: ${event.eventType}`);
    }
  }

  private async handleProjectCreated(event: ProjectCreatedEvent): Promise<void> {
    this.logger.log(
      `📊 [NOTIFICATION] Project Created: "${event.projectName}" (ID: ${event.projectId}) by user ${event.createdById}`
    );
    // TODO: Send email to project owner
    // TODO: Notify team members via Slack/Teams
  }

  private async handleTaskAssigned(event: TaskAssignedEvent): Promise<void> {
    this.logger.log(
      `📝 [NOTIFICATION] Task Assigned: "${event.taskTitle}" to agent ${event.agentRole} (Project: ${event.projectId})`
    );
    // TODO: Send notification to agent monitoring dashboard
    // TODO: Log to task assignment queue
  }

  private async handleTaskCompleted(event: TaskCompletedEvent): Promise<void> {
    this.logger.log(
      `✅ [NOTIFICATION] Task Completed: "${event.taskTitle}" by ${event.agentRole} (Project: ${event.projectId})` +
      (event.executionTimeMs ? ` in ${event.executionTimeMs}ms` : '')
    );
    // TODO: Notify project stakeholders of completion
    // TODO: Update project dashboard
  }

  private async handleWorkflowStarted(event: WorkflowStartedEvent): Promise<void> {
    this.logger.log(
      `🚀 [NOTIFICATION] Workflow Started: ${event.workflowDefId} (Run ID: ${event.workflowRunId}, Project: ${event.projectId})`
    );
    // TODO: Send workflow start notification
    // TODO: Initialize monitoring dashboard
  }

  private async handleWorkflowCompleted(event: WorkflowCompletedEvent): Promise<void> {
    this.logger.log(
      `🎉 [NOTIFICATION] Workflow Completed: Run ID ${event.workflowRunId} (Project: ${event.projectId})`
    );
    // TODO: Send workflow completion notification
    // TODO: Generate workflow summary report
  }

  private async handleApprovalRequested(event: ApprovalRequestedEvent): Promise<void> {
    this.logger.log(
      `⏸️ [NOTIFICATION] Approval Requested: Type ${event.approvalType} for workflow ${event.workflowRunId} (Project: ${event.projectId})`
    );
    // TODO: Send urgent notification to approvers
    // TODO: Create approval request in notification center
  }
}

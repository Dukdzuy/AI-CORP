/**
 * Workflow Completed Event
 * 
 * Raised when a workflow run completes successfully.
 * Triggers project completion and final notifications.
 * 
 * @pattern Domain Event
 */

import { DomainEvent } from './DomainEvent';

export class WorkflowCompletedEvent extends DomainEvent {
  readonly eventType = 'workflow.completed';

  constructor(
    readonly projectId: string,
    readonly workflowId: string
  ) {
    super();
  }
}

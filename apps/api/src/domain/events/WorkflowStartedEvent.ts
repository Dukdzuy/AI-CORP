/**
 * Workflow Started Event
 * 
 * Raised when a workflow execution begins.
 * Tracks workflow metrics and triggers initialization notifications.
 * 
 * @pattern Observer Pattern
 * @principle Event-Driven Architecture
 */

import { DomainEvent } from './DomainEvent';

export class WorkflowStartedEvent extends DomainEvent {
  readonly eventType = 'workflow.started';

  constructor(
    public readonly workflowRunId: string,
    public readonly projectId: string,
    public readonly workflowDefId: string,
    public readonly startedBy?: string
  ) {
    super();
  }
}

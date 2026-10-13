/**
 * Workflow Paused Event
 * 
 * Raised when a workflow is paused (e.g., budget exceeded, manual pause).
 * Triggers notifications to inform users about the pause reason.
 * 
 * @pattern Domain Event
 */

import { DomainEvent } from './DomainEvent';

export class WorkflowPausedEvent extends DomainEvent {
  readonly eventType = 'workflow.paused';

  constructor(
    readonly projectId: string,
    readonly reason: string
  ) {
    super();
  }
}

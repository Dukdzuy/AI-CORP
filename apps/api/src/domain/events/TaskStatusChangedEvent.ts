/**
 * Task Status Changed Event
 * 
 * Raised when a task's status changes (e.g., todo -> in_progress -> done).
 * Triggers UI updates and workflow progression checks.
 * 
 * @pattern Domain Event
 */

import { DomainEvent } from './DomainEvent';

export class TaskStatusChangedEvent extends DomainEvent {
  readonly eventType = 'task.status.changed';

  constructor(
    readonly taskId: string,
    readonly projectId: string,
    readonly oldStatus: string,
    readonly newStatus: string
  ) {
    super();
  }
}

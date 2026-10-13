/**
 * Task Assigned Event
 * 
 * Raised when a task is assigned to an agent for execution.
 * Triggers notifications and tracks task assignment metrics.
 * 
 * @pattern Observer Pattern
 * @principle Event-Driven Architecture
 */

import { DomainEvent } from './DomainEvent';

export class TaskAssignedEvent extends DomainEvent {
  readonly eventType = 'task.assigned';

  constructor(
    public readonly taskId: string,
    public readonly projectId: string,
    public readonly agentRole: string,
    public readonly taskTitle: string,
    public readonly priority?: string
  ) {
    super();
  }
}

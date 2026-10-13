/**
 * Task Completed Event
 * 
 * Raised when an agent successfully completes a task.
 * Triggers completion notifications and tracks performance metrics.
 * 
 * @pattern Observer Pattern
 * @principle Event-Driven Architecture
 */

import { DomainEvent } from './DomainEvent';

export class TaskCompletedEvent extends DomainEvent {
  readonly eventType = 'task.completed';

  constructor(
    public readonly taskId: string,
    public readonly projectId: string,
    public readonly agentRole: string,
    public readonly taskTitle: string,
    public readonly executionTimeMs?: number,
    public readonly result?: any
  ) {
    super();
  }
}

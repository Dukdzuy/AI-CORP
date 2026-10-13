/**
 * Agent Completed Task Event
 * 
 * Raised when an agent successfully completes a task.
 * Triggers task status updates and workflow progression.
 * 
 * @pattern Domain Event
 */

import { DomainEvent } from './DomainEvent';

export class AgentCompletedTaskEvent extends DomainEvent {
  readonly eventType = 'agent.task.completed';

  constructor(
    readonly agentId: string,
    readonly taskId: string,
    readonly projectId: string,
    readonly result: any
  ) {
    super();
  }
}

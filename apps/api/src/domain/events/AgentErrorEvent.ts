/**
 * Agent Error Event
 * 
 * Raised when an agent encounters an error during execution.
 * Triggers error notifications and potential workflow retry logic.
 * 
 * @pattern Domain Event
 */

import { DomainEvent } from './DomainEvent';

export class AgentErrorEvent extends DomainEvent {
  readonly eventType = 'agent.error';

  constructor(
    readonly agentId: string,
    readonly taskId: string,
    readonly projectId: string,
    readonly error: string
  ) {
    super();
  }
}

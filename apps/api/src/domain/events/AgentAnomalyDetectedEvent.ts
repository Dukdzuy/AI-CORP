/**
 * Agent Anomaly Detected Event (Phase 6, Task 24)
 *
 * Raised when an agent role's performance crosses an anomaly rule (success rate drop,
 * repeated failures, cost spike, slowdown, low quality). Reaches the audit log and the
 * `agent.anomaly` webhook.
 *
 * @pattern Domain Event
 */
import { DomainEvent } from './DomainEvent';

export class AgentAnomalyDetectedEvent extends DomainEvent {
  readonly eventType = 'agent.anomaly';

  constructor(
    readonly agentRole: string,
    readonly anomalyType: string,
    readonly severity: string,
    readonly message: string,
    readonly value: number,
    readonly threshold: number,
    /** The run whose end triggered the check, if any */
    readonly projectId: string | null = null
  ) {
    super();
  }
}

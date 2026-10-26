/**
 * Quality Gate Evaluated Event
 *
 * Raised by QualityGateHandler after a gate (e.g. the OOAD gate) has been evaluated.
 * The learning handler uses it as the outcome signal of the BA and Architect executions.
 *
 * @pattern Observer Pattern
 */

import { DomainEvent } from './DomainEvent';

export class QualityGateEvaluatedEvent extends DomainEvent {
  readonly eventType = 'quality.gate.evaluated';

  constructor(
    readonly projectId: string,
    readonly gateId: string,
    readonly passed: boolean,
    readonly score: number,
    /** "name: actual (expected X)" of each failed check */
    readonly failedChecks: string[]
  ) {
    super();
  }
}

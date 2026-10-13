/**
 * Budget Exceeded Event
 * 
 * Raised when a project's cost exceeds its budget.
 * Triggers automatic workflow pause and notifications.
 * 
 * Business Rule: When cost >= budget, pause workflow and alert user
 * 
 * @pattern Domain Event
 */

import { DomainEvent } from './DomainEvent';

export class BudgetExceededEvent extends DomainEvent {
  readonly eventType = 'project.budget.exceeded';

  constructor(
    readonly projectId: string,
    readonly currentCost: number,
    readonly budget: number
  ) {
    super();
  }
}

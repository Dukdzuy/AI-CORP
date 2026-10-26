/**
 * Report Generated Event (Phase 5, Task 23)
 *
 * Raised when the scheduled weekly report of a project has been written to its workspace.
 *
 * @pattern Domain Event
 */
import { DomainEvent } from './DomainEvent';

export class ReportGeneratedEvent extends DomainEvent {
  readonly eventType = 'report.generated';

  constructor(
    readonly projectId: string,
    readonly period: string,
    readonly path: string,
    readonly totalCost: number
  ) {
    super();
  }
}

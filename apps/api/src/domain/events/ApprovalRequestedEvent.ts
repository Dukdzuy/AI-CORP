/**
 * Approval Requested Event
 * 
 * Raised when a workflow step requires human approval.
 * Triggers notification to stakeholders and tracks approval metrics.
 * 
 * @pattern Observer Pattern
 * @principle Event-Driven Architecture
 */

import { DomainEvent } from './DomainEvent';

export class ApprovalRequestedEvent extends DomainEvent {
  readonly eventType = 'approval.requested';

  constructor(
    public readonly approvalId: string,
    public readonly projectId: string,
    public readonly workflowRunId: string,
    public readonly requestedBy: string,
    public readonly approvalType: string,
    public readonly context?: any
  ) {
    super();
  }
}

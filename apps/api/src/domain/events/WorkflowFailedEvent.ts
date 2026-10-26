/**
 * Workflow Failed Event (Phase 5)
 *
 * Raised when a top-level run stops in the `failed` state: a node failed with no `onFail`
 * edge to follow, or a loop exceeded its visit limit. Audited, and sent to webhooks.
 *
 * @pattern Domain Event
 */
import { DomainEvent } from './DomainEvent';

export class WorkflowFailedEvent extends DomainEvent {
  readonly eventType = 'workflow.failed';

  constructor(
    readonly projectId: string,
    readonly workflowRunId: string,
    readonly nodeId: string | null,
    readonly reason: string
  ) {
    super();
  }
}

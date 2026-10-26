/**
 * Public webhook payloads (Phase 5, Task 22): the stable, documented shape an integration
 * receives, mapped from internal domain events. Internal fields (agent outputs, LLM text)
 * never leave the platform.
 *
 * @pattern Adapter (domain event → public contract)
 */
import { WebhookEventName } from '@ai-corp/shared-types';
import { DomainEvent } from '../../domain/events/DomainEvent';

export interface WebhookEnvelope {
  id: string;            // delivery-independent event id (dedupe on this)
  event: WebhookEventName | 'webhook.test';
  occurredAt: string;
  projectId: string | null;
  data: Record<string, unknown>;
}

type PayloadMapper = (e: any) => { projectId: string | null; data: Record<string, unknown> };

export const WEBHOOK_PAYLOADS: Record<WebhookEventName, PayloadMapper> = {
  [WebhookEventName.PROJECT_CREATED]: e => ({ projectId: e.projectId, data: { name: e.projectName, budget: e.budget ?? null } }),
  [WebhookEventName.WORKFLOW_STARTED]: e => ({ projectId: e.projectId, data: { runId: e.workflowRunId, definition: e.workflowDefId } }),
  [WebhookEventName.WORKFLOW_COMPLETED]: e => ({ projectId: e.projectId, data: { runId: e.workflowId } }),
  [WebhookEventName.WORKFLOW_FAILED]: e => ({ projectId: e.projectId, data: { runId: e.workflowRunId, nodeId: e.nodeId, reason: e.reason } }),
  [WebhookEventName.APPROVAL_REQUESTED]: e => ({ projectId: e.projectId, data: { approvalId: e.approvalId, runId: e.workflowRunId, approvalType: e.approvalType } }),
  [WebhookEventName.QUALITY_GATE_EVALUATED]: e => ({ projectId: e.projectId, data: { gateId: e.gateId, passed: e.passed, score: e.score, failedChecks: e.failedChecks } }),
  [WebhookEventName.BUDGET_EXCEEDED]: e => ({ projectId: e.projectId, data: { currentCost: e.currentCost, budget: e.budget } }),
  [WebhookEventName.REPORT_GENERATED]: e => ({ projectId: e.projectId, data: { period: e.period, path: e.path, totalCost: e.totalCost } }),
};

export function toEnvelope(event: DomainEvent): WebhookEnvelope | null {
  const mapper = WEBHOOK_PAYLOADS[event.eventType as WebhookEventName];
  if (!mapper) return null;
  const { projectId, data } = mapper(event);
  return { id: event.eventId, event: event.eventType as WebhookEventName, occurredAt: event.occurredOn.toISOString(), projectId, data };
}

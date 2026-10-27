/**
 * Audit Log Handler (Phase 5, Task 21; was a console placeholder)
 *
 * Persists what the system and the agents did, as told by domain events, into the same
 * audit trail as user actions. User actions themselves are recorded by the AuditInterceptor,
 * so events that only echo a user's request (project.created) are not recorded twice.
 *
 * @pattern Observer, Adapter (domain event → audit entry)
 * @principle Single Responsibility - only handles audit logging
 */

import { Injectable } from '@nestjs/common';
import { IEventHandler } from '../../../domain/events/EventBus';
import { DomainEvent } from '../../../domain/events/DomainEvent';
import { AuditActor, NewAuditEntry } from '../../../domain/audit';
import { AuditLogService } from '../../audit/audit-log.service';

type Mapper = (e: any) => Omit<NewAuditEntry, 'action'> & { action?: string };

const SYSTEM: AuditActor = { type: 'system', label: 'workflow-engine' };
const agent = (role: string | undefined): AuditActor => ({ type: 'agent', agentRole: role ?? null, label: role ?? 'agent' });

/** Domain events that become audit entries, and how */
export const AUDITED_EVENTS: Record<string, Mapper> = {
  'workflow.started': e => ({ actor: e.startedBy ? { type: 'user', userId: e.startedBy } : SYSTEM, resourceType: 'Workflow', resourceId: e.workflowRunId, projectId: e.projectId, changes: { definition: e.workflowDefId } }),
  'workflow.completed': e => ({ actor: SYSTEM, resourceType: 'Workflow', resourceId: e.workflowId, projectId: e.projectId }),
  'workflow.failed': e => ({ actor: SYSTEM, resourceType: 'Workflow', resourceId: e.workflowRunId, projectId: e.projectId, success: false, errorMessage: e.reason, changes: { nodeId: e.nodeId } }),
  'workflow.paused': e => ({ actor: SYSTEM, resourceType: 'Project', resourceId: e.projectId, projectId: e.projectId, changes: { reason: e.reason } }),
  'approval.requested': e => ({ actor: SYSTEM, resourceType: 'Approval', resourceId: e.approvalId, projectId: e.projectId, changes: { approvalType: e.approvalType, assignee: e.requestedBy } }),
  'project.budget.exceeded': e => ({ actor: SYSTEM, resourceType: 'Project', resourceId: e.projectId, projectId: e.projectId, success: false, errorMessage: `Cost ${e.currentCost} exceeded budget ${e.budget}` }),
  'quality.gate.evaluated': e => ({ actor: agent('QA'), resourceType: 'QualityGate', resourceId: e.gateId, projectId: e.projectId, success: e.passed, errorMessage: e.passed ? null : (e.failedChecks ?? []).join('; '), changes: { score: e.score } }),
  'task.completed': e => ({ action: 'agent.task_completed', actor: agent(e.agentRole), resourceType: 'Task', resourceId: e.taskId, projectId: e.projectId, changes: { title: e.taskTitle, executionTimeMs: e.executionTimeMs } }),
  'agent.error': e => ({ actor: { type: 'agent', label: e.agentId }, resourceType: 'Task', resourceId: e.taskId, projectId: e.projectId, success: false, errorMessage: e.error }),
  'task.status.changed': e => ({ actor: SYSTEM, resourceType: 'Task', resourceId: e.taskId, projectId: e.projectId, changes: { diff: [{ field: 'status', from: e.oldStatus, to: e.newStatus }] } }),
  'agent.anomaly': e => ({ actor: { type: 'system', label: 'agent-analytics' }, resourceType: 'Agent', resourceId: e.agentRole, projectId: e.projectId, success: false, errorMessage: e.message, changes: { type: e.anomalyType, severity: e.severity, value: e.value, threshold: e.threshold } }),
  'report.generated': e => ({ actor: { type: 'system', label: 'report-scheduler' }, resourceType: 'Report', resourceId: e.path, projectId: e.projectId, changes: { period: e.period, totalCost: e.totalCost } }),
};

@Injectable()
export class AuditLogHandler implements IEventHandler {
  constructor(private readonly audit: AuditLogService) {}

  static eventTypes(): string[] {
    return Object.keys(AUDITED_EVENTS);
  }

  async handle(event: DomainEvent): Promise<void> {
    const mapper = AUDITED_EVENTS[event.eventType];
    if (!mapper) return;
    const { action, ...entry } = mapper(event);
    await this.audit.record({ ...entry, action: action ?? event.eventType, timestamp: event.occurredOn });
  }
}

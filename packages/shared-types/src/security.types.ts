/**
 * Access control contract shared by the API and the web app (Phase 5, Task 20).
 * The role → permission matrix itself lives in the API's domain layer (RolePolicy);
 * the web app only receives the resolved permission list of the signed-in user.
 */

export enum Permission {
  PROJECT_CREATE = 'project:create',
  PROJECT_READ = 'project:read',
  PROJECT_UPDATE = 'project:update',
  PROJECT_DELETE = 'project:delete',
  PROJECT_EXPORT = 'project:export',
  TASK_MANAGE = 'task:manage',
  WORKFLOW_CONTROL = 'workflow:control',
  APPROVAL_GRANT = 'approval:grant',
  AGENT_CONFIGURE = 'agent:configure',
  REPORT_VIEW = 'report:view',
  USER_MANAGE = 'user:manage',
  AUDIT_VIEW = 'audit:view',
  INTEGRATION_MANAGE = 'integration:manage',
}

export enum UserRoleName {
  ADMIN = 'admin',
  BOARD_MEMBER = 'board_member',
  VIEWER = 'viewer',
}

/** Events an integration can subscribe a webhook to (Task 22) */
export enum WebhookEventName {
  PROJECT_CREATED = 'project.created',
  WORKFLOW_STARTED = 'workflow.started',
  WORKFLOW_COMPLETED = 'workflow.completed',
  WORKFLOW_FAILED = 'workflow.failed',
  APPROVAL_REQUESTED = 'approval.requested',
  QUALITY_GATE_EVALUATED = 'quality.gate.evaluated',
  BUDGET_EXCEEDED = 'project.budget.exceeded',
  REPORT_GENERATED = 'report.generated',
  AGENT_ANOMALY = 'agent.anomaly', // Phase 6, Task 24
}

export type ExportFormat = 'json' | 'csv' | 'pdf';

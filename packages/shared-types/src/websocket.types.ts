// WebSocket event types for AI Corp Platform

import { AgentRole } from './agent.types';

export enum WebSocketEventType {
  AGENT_THINKING = 'agent:thinking',
  AGENT_ACTION = 'agent:action',
  AGENT_MESSAGE = 'agent:message',
  TASK_UPDATED = 'task:updated',
  WORKFLOW_STATE_CHANGED = 'workflow:state_changed',
  HUMAN_APPROVAL_REQUIRED = 'human:approval_required',
  SYSTEM_NOTIFICATION = 'system:notification',
  /** OOAD quality gate evaluated (QualityGateHandler) */
  QUALITY_GATE_RESULT = 'quality_gate_result',
  /** DEV / QC quality warning (missing UC ids, low coverage, failing use cases) */
  QUALITY_WARNING = 'quality_warning',
}

export interface WebSocketEvent {
  type: WebSocketEventType;
  timestamp: Date;
  data: unknown;
  projectId?: string;
}

export interface AgentThinkingEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  message: string;
}

export interface AgentActionEvent {
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  actionType: string;
  toolName: string;
  parameters: Record<string, unknown>;
}

export interface AgentMessageEvent {
  agentId: string;
  agentRole: AgentRole;
  fromAgent: AgentRole;
  toAgent: AgentRole | 'all';
  message: string;
  messageType: 'chat' | 'thinking' | 'action' | 'notification';
  timestamp: Date;
}

export interface TaskUpdatedEvent {
  taskId: string;
  projectId: string;
  title: string;
  status: string;
  previousStatus: string;
  updatedAt: Date;
}

export interface WorkflowStateChangedEvent {
  workflowRunId: string;
  projectId: string;
  previousState: string;
  currentState: string;
  currentNodeId?: string;
  timestamp: Date;
}

export interface ApprovalEvent {
  approvalId: string;
  workflowRunId: string;
  projectId: string;
  approvalType: string;
  requestData: Record<string, unknown>;
  requestedAt: Date;
}

// Alias for consistency with different naming conventions
export type ApprovalRequiredEvent = ApprovalEvent;

export interface ApprovalResponse {
  approvalId: string;
  status: 'approved' | 'rejected';
  comment?: string;
  respondedAt: Date;
}

export interface SystemNotificationEvent {
  notificationId: string;
  severity: 'info' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface QualityGateChecklistItem {
  name: string;
  actual?: unknown;
  expected?: unknown;
  passed: boolean;
}

/** Payload of quality_gate_result (sent as { type, payload } on project_event) */
export interface QualityGateResultEvent {
  gateId: string;
  passed: boolean;
  score: number;
  checklist: QualityGateChecklistItem[];
}

/** Payload of quality_warning (sent as { type, payload } on project_event) */
export interface QualityWarningEvent {
  message: string;
  severity: 'info' | 'warning' | 'error';
  missingUseCases?: string[];
  failingUseCases?: string[];
}

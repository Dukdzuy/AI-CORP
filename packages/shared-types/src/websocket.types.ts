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
  /** Project the agent works for (lets the Virtual Office filter by project) */
  projectId?: string;
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  message: string;
}

export interface AgentActionEvent {
  projectId?: string;
  agentId: string;
  agentRole: AgentRole;
  taskId: string;
  actionType: string;
  toolName: string;
  parameters: Record<string, unknown>;
}

export type AclPerformative = 'REQUEST' | 'INFORM' | 'PROPOSE' | 'ACCEPT' | 'REJECT';

export interface AgentMessageEvent {
  id?: string;
  projectId?: string;
  agentId: string;
  agentRole: AgentRole;
  fromAgent: AgentRole;
  toAgent: AgentRole | 'all';
  message: string;
  /** 'acl' = an agent-to-agent message through AgentMessageBus (Task 15) */
  messageType: 'chat' | 'thinking' | 'action' | 'notification' | 'acl';
  timestamp: Date;
  /** FIPA-ACL fields, present when messageType is 'acl' */
  performative?: AclPerformative;
  conversationId?: string;
  inReplyTo?: string;
  /** Collaboration pattern that produced the message, e.g. pair_develop */
  protocol?: string;
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

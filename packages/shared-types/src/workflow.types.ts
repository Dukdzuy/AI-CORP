// Workflow types for AI Corp Platform

import { AgentRole } from './agent.types';

export type NodeType = 'agent_task' | 'human_approval' | 'condition' | 'parallel';

export interface WorkflowNode {
  id: string;
  type: NodeType;
  agentRole?: AgentRole;
  taskType?: string;
  conditions?: {
    onSuccess?: string;
    onFail?: string;
    onApprove?: string;
    onReject?: string;
  };
  maxRetries?: number;
  timeout?: number;
  metadata?: Record<string, unknown>;
}

export interface WorkflowEdge {
  from: string;
  to: string;
  condition?: string;
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  startNode: string;
  endNode: string;
}

export interface WorkflowContext {
  projectId: string;
  goal?: string;
  milestones?: unknown[];
  tasks?: unknown[];
  variables: Record<string, unknown>;
}

export interface WorkflowRun {
  id: string;
  projectId: string;
  workflowDefId: string;
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentNodeId?: string;
  context: WorkflowContext;
  startedAt: Date;
  completedAt?: Date;
}

export interface WorkflowStep {
  id: string;
  workflowRunId: string;
  nodeId: string;
  taskId?: string;
  agentRole?: AgentRole;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  retryCount: number;
  startedAt?: Date;
  completedAt?: Date;
}

export interface NodeResult {
  status: 'success' | 'failure' | 'pending_approval';
  output?: unknown;
  error?: string;
}

export interface Approval {
  id: string;
  workflowRunId: string;
  userId: string;
  approvalType: string;
  status: 'pending' | 'approved' | 'rejected';
  requestData: Record<string, unknown>;
  comment?: string;
  requestedAt: Date;
  respondedAt?: Date;
}

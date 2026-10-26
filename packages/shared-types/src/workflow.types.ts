// Workflow types for AI Corp Platform

import { AgentRole } from './agent.types';

export type NodeType =
  | 'agent_task'
  | 'human_approval'
  | 'condition'
  | 'parallel'
  | 'quality_gate'
  | 'agent_collaboration'
  | 'sub_workflow';

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
  /** sub_workflow nodes: the workflow definition this node runs (Task 16) */
  subWorkflowId?: string;
  /** sub_workflow nodes: pinned version of that definition; resolved to the latest one at registration when missing */
  subWorkflowVersion?: string;
  metadata?: Record<string, unknown>;
}

/**
 * One branch of a parallel node (Task 18): the node to run and the branches that must finish first
 */
export interface ParallelBranch {
  nodeId: string;
  dependsOn?: string[];
}

/** What a parallel node reports for each branch; drives the timeline (Gantt) view */
export interface ParallelBranchResult {
  nodeId: string;
  status: 'success' | 'failure' | 'skipped';
  layer: number;
  startedAt?: string;
  finishedAt?: string;
  durationMs?: number;
  error?: string;
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

/** Typed parameter of a workflow template (Task 19) */
export interface WorkflowTemplateParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'enum';
  label: string;
  description: string;
  required: boolean;
  defaultValue?: string | number | boolean;
  /** enum parameters */
  options?: string[];
  /** number parameters */
  min?: number;
  max?: number;
}

export type WorkflowTemplateCategory = 'software_development' | 'design' | 'custom';

/** A template as the API lists it */
export interface WorkflowTemplateSummary {
  id: string;
  name: string;
  description: string;
  category: WorkflowTemplateCategory;
  version: string;
  parameters: WorkflowTemplateParameter[];
}

/** A template instantiated with parameters: the main definition and the sub-workflows it uses */
export interface InstantiatedWorkflow {
  templateId: string;
  parameters: Record<string, string | number | boolean>;
  definition: WorkflowDefinition;
  subWorkflows: WorkflowDefinition[];
}

/** Memento of a run taken before a node executes (Task 17) */
export interface WorkflowSnapshotSummary {
  id: string;
  workflowRunId: string;
  sequence: number;
  nodeId: string;
  status: string;
  createdAt: string | Date;
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
  workflowDefVersion?: string;
  /** Set on the runs of sub-workflows: the run and node that started them */
  parentRunId?: string;
  parentNodeId?: string;
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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  requestData: Record<string, unknown>;
  comment?: string;
  requestedAt: Date;
  respondedAt?: Date;
}

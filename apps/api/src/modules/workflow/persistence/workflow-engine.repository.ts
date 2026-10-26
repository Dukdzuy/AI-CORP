/**
 * Workflow Engine Repository (port)
 * Every read and write the WorkflowEngine and its node strategies make goes
 * through this interface, so the engine no longer depends on Prisma directly
 * (Dependency Inversion Principle).
 */

export const WORKFLOW_ENGINE_REPOSITORY = Symbol('IWorkflowEngineRepository');

export interface WorkflowRunRecord {
  id: string;
  projectId: string;
  workflowDefId: string;
  status: string;
  currentNodeId: string | null;
  context: unknown;
  startedAt: Date;
  completedAt: Date | null;
}

export interface WorkflowStepRecord {
  id: string;
  workflowRunId: string;
  nodeId: string;
  status: string;
  startedAt: Date | null;
}

export interface ProjectWithOwnerRecord {
  id: string;
  createdById: string;
}

export interface TaskRecord {
  id: string;
  projectId: string;
  status: string;
}

export interface ApprovalRecord {
  id: string;
}

export interface CreateRunInput {
  projectId: string;
  workflowDefId: string;
  status: string;
  currentNodeId: string;
  context: any;
}

export interface UpdateRunInput {
  status?: string;
  currentNodeId?: string;
  context?: any;
  completedAt?: Date;
}

export interface CreateStepInput {
  workflowRunId: string;
  nodeId: string;
  agentRole?: string;
  status: string;
  startedAt: Date;
  retryCount: number;
}

export interface UpdateStepInput {
  status: string;
  output?: string;
  error?: string;
  completedAt: Date;
  durationMs?: number;
}

export interface CreateApprovalInput {
  workflowRunId: string;
  userId: string;
  approvalType: string;
  requestData: any;
  status: string;
}

export interface IWorkflowEngineRepository {
  // Workflow runs
  createRun(data: CreateRunInput): Promise<WorkflowRunRecord>;
  findRunById(runId: string): Promise<WorkflowRunRecord | null>;
  findRunsByStatus(status: string): Promise<WorkflowRunRecord[]>;
  updateRun(runId: string, data: UpdateRunInput): Promise<unknown>;

  // Workflow steps
  createStep(data: CreateStepInput): Promise<WorkflowStepRecord>;
  updateStep(stepId: string, data: UpdateStepInput): Promise<unknown>;

  // Projects
  findProjectWithOwner(projectId: string): Promise<ProjectWithOwnerRecord | null>;
  updateProjectStatus(projectId: string, status: string): Promise<unknown>;

  // Task status updates driven by agent results
  findLatestTaskByStatus(projectId: string, status: string): Promise<TaskRecord | null>;
  updateTaskStatus(taskId: string, status: string): Promise<unknown>;

  // Approvals
  createApproval(data: CreateApprovalInput): Promise<ApprovalRecord>;
}

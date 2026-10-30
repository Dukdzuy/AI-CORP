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
  workflowDefVersion?: string | null;
  parentRunId?: string | null;
  parentNodeId?: string | null;
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
  agentRole?: string | null;
  completedAt?: Date | null;
  durationMs?: number | null;
  error?: string | null;
}

export interface WorkflowSnapshotRecord {
  id: string;
  workflowRunId: string;
  sequence: number;
  nodeId: string;
  status: string;
  context: unknown;
  createdAt: Date;
}

export interface CreateSnapshotInput {
  workflowRunId: string;
  sequence: number;
  nodeId: string;
  status: string;
  context: any;
  createdAt: Date;
}

export interface ProjectWithOwnerRecord {
  id: string;
  createdById: string;
}

/** What the engine needs to keep a run inside its project's budget */
export interface ProjectBudgetRecord {
  status: string;
  budget: number | null;
  costAccrued: number;
}

export interface ApprovalRecord {
  id: string;
}

export interface CreateRunInput {
  projectId: string;
  workflowDefId: string;
  workflowDefVersion?: string;
  parentRunId?: string;
  parentNodeId?: string;
  status: string;
  currentNodeId: string;
  context: any;
}

export interface UpdateRunInput {
  status?: string;
  currentNodeId?: string;
  context?: any;
  completedAt?: Date | null;
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
  /** Top-level runs only: sub-workflow runs are driven by their parent's node */
  findRunsByStatus(status: string): Promise<WorkflowRunRecord[]>;
  findChildRuns(parentRunId: string): Promise<WorkflowRunRecord[]>;
  updateRun(runId: string, data: UpdateRunInput): Promise<unknown>;

  // Workflow steps
  createStep(data: CreateStepInput): Promise<WorkflowStepRecord>;
  updateStep(stepId: string, data: UpdateStepInput): Promise<unknown>;
  /** Steps still 'running' of a run, e.g. cut short by a restart, are marked failed with `error` */
  failRunningSteps(runId: string, error: string): Promise<number>;
  findStepsByRun(runId: string): Promise<WorkflowStepRecord[]>;

  // Snapshots (Memento caretaker storage, Task 17)
  createSnapshot(data: CreateSnapshotInput): Promise<WorkflowSnapshotRecord>;
  findSnapshots(runId: string): Promise<WorkflowSnapshotRecord[]>;
  /** Drop the snapshots taken after `sequence` (the history a rollback discards) */
  deleteSnapshotsAfter(runId: string, sequence: number): Promise<unknown>;

  // Projects
  findProjectWithOwner(projectId: string): Promise<ProjectWithOwnerRecord | null>;
  updateProjectStatus(projectId: string, status: string): Promise<unknown>;
  /** Marks the project completed unless it was cancelled meanwhile */
  completeProject(projectId: string): Promise<unknown>;
  findProjectBudget(projectId: string): Promise<ProjectBudgetRecord | null>;
  /** Latest top-level run of a project, or null */
  findLatestRun(projectId: string): Promise<WorkflowRunRecord | null>;

  // Approvals
  createApproval(data: CreateApprovalInput): Promise<ApprovalRecord>;
  /** Pending approvals of a run a rollback moved away from; returns how many were cancelled */
  cancelPendingApprovals(runId: string, reason?: string): Promise<number>;
  countPendingApprovals(runId: string): Promise<number>;
}

/**
 * Workflow Repository Interface
 * Follows Dependency Inversion Principle (SOLID)
 */

export interface WorkflowRunDTO {
  id: string;
  projectId: string;
  workflowDefId: string;
  workflowDefVersion?: string | null;
  status: string;
  currentNodeId: string | null;
  context: any;
  startedAt: Date;
  completedAt: Date | null;
}

export interface WorkflowStepDTO {
  id: string;
  workflowRunId: string;
  taskId: string | null;
  nodeId: string;
  agentRole: string | null;
  status: string;
  input: any | null;
  output: any | null;
  error: string | null;
  retryCount: number;
  startedAt: Date | null;
  completedAt: Date | null;
  durationMs: number | null;
}

export interface CreateWorkflowRunData {
  projectId: string;
  workflowDefId: string;
  status?: string;
  currentNodeId?: string;
  context: any;
}

export interface UpdateWorkflowRunData {
  status?: string;
  currentNodeId?: string;
  context?: any;
  completedAt?: Date;
}

export interface CreateWorkflowStepData {
  workflowRunId: string;
  taskId?: string;
  nodeId: string;
  agentRole?: string;
  status?: string;
  input?: any;
}

export interface UpdateWorkflowStepData {
  status?: string;
  output?: any;
  error?: string;
  retryCount?: number;
  startedAt?: Date;
  completedAt?: Date;
  durationMs?: number;
}

/**
 * Repository interface for Workflow aggregates
 */
export interface IWorkflowRepository {
  // WorkflowRun operations
  /**
   * Find workflow run by ID
   */
  findRunById(runId: string): Promise<WorkflowRunDTO | null>;

  /**
   * Find workflow runs by project ID
   */
  findRunsByProjectId(projectId: string, options?: { limit?: number }): Promise<WorkflowRunDTO[]>;

  /**
   * Create a new workflow run
   */
  createRun(data: CreateWorkflowRunData): Promise<WorkflowRunDTO>;

  /**
   * Update workflow run status and context
   */
  updateRun(runId: string, data: UpdateWorkflowRunData): Promise<WorkflowRunDTO>;

  /**
   * Delete a workflow run
   */
  deleteRun(runId: string): Promise<void>;

  // WorkflowStep operations
  /**
   * Find workflow step by ID
   */
  findStepById(stepId: string): Promise<WorkflowStepDTO | null>;

  /**
   * Find all steps for a workflow run
   */
  findStepsByRunId(runId: string): Promise<WorkflowStepDTO[]>;

  /**
   * Create a new workflow step
   */
  createStep(data: CreateWorkflowStepData): Promise<WorkflowStepDTO>;

  /**
   * Update a workflow step
   */
  updateStep(stepId: string, data: UpdateWorkflowStepData): Promise<WorkflowStepDTO>;

  /**
   * Delete all steps for a workflow run
   */
  deleteStepsByRunId(runId: string): Promise<void>;
}

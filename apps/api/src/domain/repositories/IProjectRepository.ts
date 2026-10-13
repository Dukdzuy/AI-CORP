/**
 * Project Repository Interface
 * Follows Dependency Inversion Principle (SOLID)
 * Domain layer defines the contract, infrastructure implements it
 */

export interface ProjectDTO {
  id: string;
  name: string;
  description: string;
  goal: string;
  status: string;
  budget: number | null;
  costAccrued: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectData {
  name: string;
  description: string;
  goal: string;
  budget?: number;
  createdById: string;
}

export interface UpdateProjectData {
  name?: string;
  description?: string;
  goal?: string;
  status?: string;
  budget?: number;
  costAccrued?: number;
}

export interface MilestoneDTO {
  id: string;
  projectId: string;
  name: string;
  description: string;
  status: string;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TaskDTO {
  id: string;
  projectId: string;
  milestoneId: string | null;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedAgent: string | null;
  estimatedCost: number | null;
  actualCost: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowRunDTO {
  id: string;
  projectId: string;
  workflowDefId: string;
  status: string;
  currentNodeId: string | null;
  context: any;
  startedAt: Date;
  completedAt: Date | null;
}

/**
 * Repository interface for Project aggregate
 * Abstracts data access layer from domain logic
 */
export interface IProjectRepository {
  /**
   * Find project by ID
   */
  findById(id: string): Promise<ProjectDTO | null>;

  /**
   * Find all projects with optional ordering
   */
  findAll(options?: {
    orderBy?: 'createdAt' | 'updatedAt';
    order?: 'asc' | 'desc';
  }): Promise<ProjectDTO[]>;

  /**
   * Find all projects created by a specific user
   */
  findByUserId(userId: string): Promise<ProjectDTO[]>;

  /**
   * Create a new project
   */
  create(data: CreateProjectData): Promise<ProjectDTO>;

  /**
   * Update an existing project
   */
  update(id: string, data: UpdateProjectData): Promise<ProjectDTO>;

  /**
   * Delete a project and all related data
   */
  delete(id: string): Promise<void>;

  /**
   * Increment project cost and auto-pause if budget exceeded
   */
  updateCost(id: string, amount: number): Promise<ProjectDTO>;

  /**
   * Find project with its milestones
   */
  findWithMilestones(id: string): Promise<(ProjectDTO & { milestones: MilestoneDTO[] }) | null>;

  /**
   * Find project with its tasks
   */
  findWithTasks(id: string): Promise<(ProjectDTO & { tasks: TaskDTO[] }) | null>;

  /**
   * Find project with workflow runs
   */
  findWithWorkflowRuns(
    id: string,
    limit?: number
  ): Promise<(ProjectDTO & { workflowRuns: WorkflowRunDTO[] }) | null>;
}

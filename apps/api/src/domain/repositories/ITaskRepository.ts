/**
 * Task Repository Interface
 * Follows Dependency Inversion Principle (SOLID)
 */

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

export interface CreateTaskData {
  projectId: string;
  milestoneId?: string;
  title: string;
  description: string;
  status?: string;
  priority?: string;
  assignedAgent?: string;
  estimatedCost?: number;
}

export interface UpdateTaskData {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  assignedAgent?: string;
  estimatedCost?: number;
  actualCost?: number;
  milestoneId?: string;
}

/**
 * Repository interface for Task aggregate
 */
export interface ITaskRepository {
  /**
   * Find task by ID
   */
  findById(id: string): Promise<TaskDTO | null>;

  /**
   * Find all tasks for a project
   */
  findByProjectId(projectId: string): Promise<TaskDTO[]>;

  /**
   * Find tasks by status within a project
   */
  findByStatus(projectId: string, status: string): Promise<TaskDTO[]>;

  /**
   * Create a new task
   */
  create(data: CreateTaskData): Promise<TaskDTO>;

  /**
   * Update a task
   */
  update(id: string, data: UpdateTaskData): Promise<TaskDTO>;

  /**
   * Delete a task
   */
  delete(id: string): Promise<void>;

  /**
   * Update task status (validates transitions)
   */
  updateStatus(id: string, status: string): Promise<TaskDTO>;

  /**
   * Increment task cost
   */
  updateCost(id: string, amount: number): Promise<TaskDTO>;
}

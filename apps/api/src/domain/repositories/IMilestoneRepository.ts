/**
 * Milestone Repository Interface
 * Follows Dependency Inversion Principle (SOLID)
 */

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

export interface CreateMilestoneData {
  projectId: string;
  name: string;
  description: string;
  status?: string;
  dueDate?: Date;
}

export interface UpdateMilestoneData {
  name?: string;
  description?: string;
  status?: string;
  dueDate?: Date;
}

/**
 * Repository interface for Milestone aggregate
 */
export interface IMilestoneRepository {
  /**
   * Find milestone by ID
   */
  findById(id: string): Promise<MilestoneDTO | null>;

  /**
   * Find all milestones for a project
   */
  findByProjectId(projectId: string): Promise<MilestoneDTO[]>;

  /**
   * Find milestones by status within a project
   */
  findByStatus(projectId: string, status: string): Promise<MilestoneDTO[]>;

  /**
   * Create a new milestone
   */
  create(data: CreateMilestoneData): Promise<MilestoneDTO>;

  /**
   * Update a milestone
   */
  update(id: string, data: UpdateMilestoneData): Promise<MilestoneDTO>;

  /**
   * Delete a milestone
   */
  delete(id: string): Promise<void>;
}

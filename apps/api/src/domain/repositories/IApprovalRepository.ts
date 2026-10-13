/**
 * Approval Repository Interface
 * Follows Dependency Inversion Principle (SOLID)
 */

export interface ApprovalDTO {
  id: string;
  workflowRunId: string;
  userId: string;
  approvalType: string;
  status: string;
  requestData: any;
  comment: string | null;
  requestedAt: Date;
  respondedAt: Date | null;
}

export interface CreateApprovalData {
  workflowRunId: string;
  userId: string;
  approvalType: string;
  requestData: any;
  status?: string;
}

export interface UpdateApprovalData {
  status?: string;
  comment?: string;
  respondedAt?: Date;
}

/**
 * Repository interface for Approval aggregate
 */
export interface IApprovalRepository {
  /**
   * Find approval by ID
   */
  findById(id: string): Promise<ApprovalDTO | null>;

  /**
   * Find approvals by project ID
   */
  findByProjectId(projectId: string): Promise<ApprovalDTO[]>;

  /**
   * Find all pending approvals
   */
  findPending(): Promise<ApprovalDTO[]>;

  /**
   * Find pending approvals for a specific workflow run
   */
  findPendingByWorkflowRun(workflowRunId: string): Promise<ApprovalDTO[]>;

  /**
   * Create a new approval request
   */
  create(data: CreateApprovalData): Promise<ApprovalDTO>;

  /**
   * Update an approval
   */
  update(id: string, data: UpdateApprovalData): Promise<ApprovalDTO>;

  /**
   * Approve an approval request
   */
  approve(id: string, comment?: string): Promise<ApprovalDTO>;

  /**
   * Reject an approval request
   */
  reject(id: string, comment?: string): Promise<ApprovalDTO>;
}

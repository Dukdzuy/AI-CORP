import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface PendingApprovalRecord {
  id: string;
  workflowRunId: string;
  userId: string;
  approvalType: string;
  status: string;
  requestData: Record<string, unknown>;
  comment: string | null;
  requestedAt: string;
  respondedAt: string | null;
  workflowRun: {
    id: string;
    projectId: string;
    currentNodeId: string;
    project?: { name: string };
  };
  /** Who the approval is assigned to (an admin sees everyone's) */
  user?: { id: string; name: string; email: string };
}

/** The shape the approval cards and modal use, from a REST record */
export const toPendingApproval = (a: PendingApprovalRecord) => ({
  approvalId: a.id,
  workflowRunId: a.workflowRunId,
  projectId: a.workflowRun?.projectId || '',
  projectName: a.workflowRun?.project?.name,
  approvalType: a.approvalType,
  requestData: a.requestData,
  requestedAt: new Date(a.requestedAt),
});

export const approvalKeys = {
  all: ['approvals'] as const,
  pending: (projectId?: string) => [...approvalKeys.all, 'pending', { projectId }] as const,
};

export const fetchPendingApprovals = async (projectId?: string): Promise<PendingApprovalRecord[]> => {
  const params: Record<string, string> = {};
  if (projectId) params.projectId = projectId;
  const { data } = await apiClient.get<PendingApprovalRecord[]>('/approvals', { params });
  return data;
};

export const usePendingApprovals = (projectId?: string) => {
  return useQuery({
    queryKey: approvalKeys.pending(projectId),
    queryFn: () => fetchPendingApprovals(projectId),
    refetchInterval: 10000,
  });
};

/**
 * Answers an approval through the REST API, which checks the APPROVAL_GRANT permission and
 * that the caller is the approval's assignee, and writes the audit entry. The UI used to send
 * the answer over the WebSocket, which bypassed all three (fixed in Phase 7).
 */
export const respondToApproval = async (approvalId: string, decision: 'approve' | 'reject', comment?: string) => {
  const { data } = await apiClient.post(`/approvals/${approvalId}/${decision}`, comment ? { comment } : {});
  return data;
};

/** Message for a failed answer: 403 means the user may not answer this approval */
export const approvalErrorMessage = (error: unknown): string => {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 403) return 'You are not allowed to answer this approval';
  if (status === 404) return 'This approval no longer exists';
  if (status === 409) return 'This approval was already answered';
  return 'Could not send your answer, please try again';
};

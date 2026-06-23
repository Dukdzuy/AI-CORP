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
  };
}

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

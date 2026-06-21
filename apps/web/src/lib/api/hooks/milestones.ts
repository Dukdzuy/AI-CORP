import { useQuery } from '@tanstack/react-query';
import { Milestone } from '@ai-corp/shared-types';
import { apiClient } from '../client';

export const milestoneKeys = {
  all: ['milestones'] as const,
  lists: () => [...milestoneKeys.all, 'list'] as const,
  list: (projectId: string) => [...milestoneKeys.lists(), { projectId }] as const,
};

export const fetchMilestones = async (projectId: string): Promise<Milestone[]> => {
  const { data } = await apiClient.get<Milestone[]>('/milestones', {
    params: { projectId },
  });
  return data;
};

export const useMilestones = (projectId: string | null) => {
  return useQuery({
    queryKey: milestoneKeys.list(projectId!),
    queryFn: () => fetchMilestones(projectId!),
    enabled: !!projectId,
  });
};

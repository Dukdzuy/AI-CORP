import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Task } from '@ai-corp/shared-types';
import { apiClient } from '../client';

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (projectId: string) => [...taskKeys.lists(), { projectId }] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

export const fetchTasks = async (projectId: string): Promise<Task[]> => {
  const { data } = await apiClient.get<Task[]>('/tasks', {
    params: { projectId },
  });
  return data;
};

export const useTasks = (projectId: string | null) => {
  return useQuery({
    queryKey: taskKeys.list(projectId!),
    queryFn: () => fetchTasks(projectId!),
    enabled: !!projectId,
  });
};

export const useUpdateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<Task> & { id: string }) => {
      const { data } = await apiClient.patch<Task>(`/tasks/${id}`, updateData);
      return data;
    },
    onSuccess: (_, variables) => {
      // Invalidate all task lists or specifically the one for the project if we know it
      queryClient.invalidateQueries({ queryKey: taskKeys.lists() });
      queryClient.invalidateQueries({ queryKey: taskKeys.detail(variables.id) });
    },
  });
};

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Project } from '@ai-corp/shared-types';
import { apiClient } from '../client';

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters: string) => [...projectKeys.lists(), { filters }] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

export const fetchProjects = async (): Promise<Project[]> => {
  const { data } = await apiClient.get<Project[]>('/projects');
  return data;
};

export const fetchProject = async (id: string): Promise<Project> => {
  const { data } = await apiClient.get<Project>(`/projects/${id}`);
  return data;
};

export const useProjects = () => {
  return useQuery({
    queryKey: projectKeys.lists(),
    queryFn: fetchProjects,
  });
};

export const useProject = (id: string | null) => {
  return useQuery({
    queryKey: projectKeys.detail(id!),
    queryFn: () => fetchProject(id!),
    enabled: !!id,
  });
};

export const useCreateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (projectData: Partial<Project> & { templateId?: string; templateParams?: Record<string, unknown> }) => {
      const { data } = await apiClient.post<Project & { workflowStarted?: boolean; workflowError?: string }>('/projects', projectData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
};

export const useUpdateProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updateData }: Partial<Project> & { id: string }) => {
      const { data } = await apiClient.patch<Project>(`/projects/${id}`, updateData);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(variables.id) });
    },
  });
};

export const useDeleteProject = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { data } = await apiClient.delete(`/projects/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
    },
  });
};

/** Start the workflow of a project whose workflow never started or stopped (failed / cancelled) */
export const useStartProjectWorkflow = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) =>
      (await apiClient.post<{ workflowStarted: boolean; workflowError?: string }>(`/projects/${id}/workflow/start`)).data,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: projectKeys.lists() });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(id) });
    },
  });
};

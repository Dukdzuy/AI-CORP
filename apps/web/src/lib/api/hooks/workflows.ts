import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { InstantiatedWorkflow, WorkflowSnapshotSummary, WorkflowTemplateSummary } from '@ai-corp/shared-types';
import { apiClient } from '../client';
import { projectKeys } from './projects';
import type { WorkflowRunTree } from '../../../components/workflow/runTree';

export const workflowKeys = {
  templates: ['workflows', 'templates'] as const,
  preview: (templateId: string, params: Record<string, unknown>) => ['workflows', 'preview', templateId, params] as const,
  run: (runId: string) => ['workflows', 'run', runId] as const,
  snapshots: (runId: string) => ['workflows', 'snapshots', runId] as const,
};

export const useWorkflowTemplates = () =>
  useQuery({
    queryKey: workflowKeys.templates,
    queryFn: async () => (await apiClient.get<WorkflowTemplateSummary[]>('/workflows/templates')).data,
    staleTime: 5 * 60 * 1000,
  });

/** The definitions a template would produce with these parameters (nothing is registered) */
export const useTemplatePreview = (templateId: string | undefined, parameters: Record<string, unknown>) =>
  useQuery({
    queryKey: workflowKeys.preview(templateId || '', parameters),
    queryFn: async () =>
      (await apiClient.post<InstantiatedWorkflow>(`/workflows/templates/${templateId}/preview`, { parameters })).data,
    enabled: !!templateId,
    retry: false,
  });

/** A run with its steps and its sub-workflow runs */
export const useWorkflowRun = (runId: string | undefined, live = false) =>
  useQuery({
    queryKey: workflowKeys.run(runId || ''),
    queryFn: async () => (await apiClient.get<WorkflowRunTree>(`/workflows/runs/${runId}`)).data,
    enabled: !!runId,
    refetchInterval: live ? 5000 : false,
  });

export const useRunSnapshots = (runId: string | undefined) =>
  useQuery({
    queryKey: workflowKeys.snapshots(runId || ''),
    queryFn: async () => (await apiClient.get<WorkflowSnapshotSummary[]>(`/workflows/runs/${runId}/snapshots`)).data,
    enabled: !!runId,
  });

function useRunMutation<TBody>(path: (runId: string) => string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ runId, body }: { runId: string; projectId: string; body?: TBody }) =>
      (await apiClient.post(path(runId), body || {})).data,
    onSuccess: (_data, { runId, projectId }) => {
      queryClient.invalidateQueries({ queryKey: workflowKeys.run(runId) });
      queryClient.invalidateQueries({ queryKey: workflowKeys.snapshots(runId) });
      queryClient.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export const useRollbackRun = () =>
  useRunMutation<{ snapshotId?: string; steps?: number }>(runId => `/workflows/runs/${runId}/rollback`);

export const useResumeRun = () => useRunMutation<never>(runId => `/workflows/runs/${runId}/resume`);

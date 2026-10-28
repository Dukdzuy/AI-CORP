import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export type ProviderKind = 'openai-compatible' | 'anthropic';

export interface LlmModelView {
  id: string;
  modelId: string;
  displayName: string;
  category: string;
  isEnabled: boolean;
  source: 'manual' | 'synced';
  createdAt: string;
}

/** The API never returns the key itself: only whether one is stored and its last 4 characters */
export interface LlmProviderView {
  id: string;
  name: string;
  kind: ProviderKind;
  baseUrl: string | null;
  isEnabled: boolean;
  hasApiKey: boolean;
  apiKeyHint: string | null;
  createdAt: string;
  updatedAt: string;
  models: LlmModelView[];
  usedBy: string[];
}

export interface RemoteModel {
  modelId: string;
  displayName?: string;
  added: boolean;
}

export interface ProviderInput {
  name?: string;
  kind?: ProviderKind;
  baseUrl?: string;
  apiKey?: string;
  clearApiKey?: boolean;
  isEnabled?: boolean;
}

export interface ModelInput {
  modelId: string;
  displayName?: string;
  category?: string;
}

export const llmProviderKeys = {
  all: ['llm-providers'] as const,
  list: () => [...llmProviderKeys.all, 'list'] as const,
  remote: (id: string) => [...llmProviderKeys.all, 'remote', id] as const,
};

export const useLlmProviders = () =>
  useQuery({ queryKey: llmProviderKeys.list(), queryFn: async () => (await apiClient.get<LlmProviderView[]>('/llm-providers')).data });

export const useRemoteModels = (id: string | null) =>
  useQuery({
    queryKey: llmProviderKeys.remote(id || ''),
    queryFn: async () => (await apiClient.get<RemoteModel[]>(`/llm-providers/${id}/remote-models`)).data,
    enabled: !!id,
    retry: false,
  });

export function useLlmProviderMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: llmProviderKeys.all });
  return {
    create: useMutation({
      mutationFn: async (body: ProviderInput) => (await apiClient.post<LlmProviderView>('/llm-providers', body)).data,
      onSuccess: refresh,
    }),
    update: useMutation({
      mutationFn: async ({ id, ...body }: ProviderInput & { id: string }) => (await apiClient.patch<LlmProviderView>(`/llm-providers/${id}`, body)).data,
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: async (id: string) => (await apiClient.delete(`/llm-providers/${id}`)).data, onSuccess: refresh }),
    test: useMutation({
      mutationFn: async (id: string) =>
        (await apiClient.post<{ ok: boolean; modelCount?: number; error?: string; latencyMs: number }>(`/llm-providers/${id}/test`)).data,
    }),
    addModels: useMutation({
      mutationFn: async ({ id, models, fromProvider }: { id: string; models: ModelInput[]; fromProvider?: boolean }) =>
        (await apiClient.post<LlmProviderView>(`/llm-providers/${id}/models`, { models, ...(fromProvider && { fromProvider }) })).data,
      onSuccess: refresh,
    }),
    updateModel: useMutation({
      mutationFn: async ({ id, modelId, ...body }: { id: string; modelId: string; displayName?: string; category?: string; isEnabled?: boolean }) =>
        (await apiClient.patch<LlmProviderView>(`/llm-providers/${id}/models/${modelId}`, body)).data,
      onSuccess: refresh,
    }),
    removeModel: useMutation({
      mutationFn: async ({ id, modelId }: { id: string; modelId: string }) => (await apiClient.delete<LlmProviderView>(`/llm-providers/${id}/models/${modelId}`)).data,
      onSuccess: refresh,
    }),
  };
}

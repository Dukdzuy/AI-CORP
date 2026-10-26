import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface ApiKeyView {
  id: string;
  name: string;
  ownerId: string;
  scopes: string[];
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
  revokedAt: string | null;
  prefix: string;
  status: 'active' | 'revoked' | 'expired';
}

export interface WebhookView {
  id: string;
  ownerId: string;
  projectId: string | null;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  secret?: string;
  secretHint?: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status: 'delivered' | 'failed';
  attempts: number;
  responseCode: number | null;
  error: string | null;
  durationMs: number;
  createdAt: string;
}

export const integrationKeys = {
  all: ['integrations'] as const,
  keys: () => [...integrationKeys.all, 'keys'] as const,
  webhooks: () => [...integrationKeys.all, 'webhooks'] as const,
  events: () => [...integrationKeys.all, 'events'] as const,
  deliveries: (id: string) => [...integrationKeys.all, 'deliveries', id] as const,
};

export const useApiKeys = () =>
  useQuery({ queryKey: integrationKeys.keys(), queryFn: async () => (await apiClient.get<ApiKeyView[]>('/integrations/api-keys')).data });

export const useWebhooks = () =>
  useQuery({ queryKey: integrationKeys.webhooks(), queryFn: async () => (await apiClient.get<WebhookView[]>('/integrations/webhooks')).data });

export const useWebhookEvents = () =>
  useQuery({ queryKey: integrationKeys.events(), queryFn: async () => (await apiClient.get<string[]>('/integrations/events')).data, staleTime: Infinity });

export const useWebhookDeliveries = (id: string | null) =>
  useQuery({
    queryKey: integrationKeys.deliveries(id || ''),
    queryFn: async () => (await apiClient.get<WebhookDelivery[]>(`/integrations/webhooks/${id}/deliveries`)).data,
    enabled: !!id,
    refetchInterval: 10_000,
  });

export function useIntegrationMutations() {
  const qc = useQueryClient();
  const refresh = () => qc.invalidateQueries({ queryKey: integrationKeys.all });
  return {
    createKey: useMutation({
      mutationFn: async (body: { name: string; scopes: string[]; expiresInDays?: number }) =>
        (await apiClient.post<{ apiKey: ApiKeyView; token: string }>('/integrations/api-keys', body)).data,
      onSuccess: refresh,
    }),
    revokeKey: useMutation({ mutationFn: async (id: string) => (await apiClient.delete(`/integrations/api-keys/${id}`)).data, onSuccess: refresh }),
    createWebhook: useMutation({
      mutationFn: async (body: { url: string; events: string[]; projectId?: string }) => (await apiClient.post<WebhookView>('/integrations/webhooks', body)).data,
      onSuccess: refresh,
    }),
    deleteWebhook: useMutation({ mutationFn: async (id: string) => (await apiClient.delete(`/integrations/webhooks/${id}`)).data, onSuccess: refresh }),
    testWebhook: useMutation({
      mutationFn: async (id: string) => (await apiClient.post<{ ok: boolean; responseCode: number | null; error: string | null }>(`/integrations/webhooks/${id}/test`)).data,
      onSuccess: refresh,
    }),
  };
}

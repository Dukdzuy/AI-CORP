import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface ServiceCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: ServiceCheck[];
}

async function fetchHealth(): Promise<HealthStatus> {
  const response = await apiClient.get('/health');
  return response.data;
}

export const healthKeys = {
  all: ['health'] as const,
  status: () => [...healthKeys.all, 'status'] as const,
};

export function useHealthStatus() {
  return useQuery({
    queryKey: healthKeys.status(),
    queryFn: fetchHealth,
    refetchInterval: 30000,
    retry: 1,
  });
}

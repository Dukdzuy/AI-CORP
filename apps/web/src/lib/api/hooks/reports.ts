import { useQuery } from '@tanstack/react-query';
import { ExportFormat } from '@ai-corp/shared-types';
import { apiClient } from '../client';
import { downloadFile } from '../download';

export interface CostBucket { key: string; cost: number; tokens: number; calls: number; share: number }
export interface CostReport {
  total: number;
  totalTokens: number;
  calls: number;
  fallbackCalls: number;
  avgResponseTimeMs: number;
  budget: number | null;
  budgetUsed: number | null;
  byAgent: CostBucket[];
  byModel: CostBucket[];
  byDay: Array<{ date: string; cost: number; calls: number }>;
}
export interface RolePerformance {
  role: string;
  executions: number;
  completed: number;
  failed: number;
  successRate: number | null;
  avgDurationMs: number;
  p95DurationMs: number;
  retries: number;
}
export interface PerformanceReport { totalSteps: number; overallSuccessRate: number | null; byRole: RolePerformance[] }

export const reportKeys = {
  cost: (projectId: string) => ['reports', 'cost', projectId] as const,
  performance: (projectId: string) => ['reports', 'performance', projectId] as const,
};

export const useCostReport = (projectId: string) =>
  useQuery({ queryKey: reportKeys.cost(projectId), queryFn: async () => (await apiClient.get<CostReport>(`/reports/projects/${projectId}/cost`)).data });

export const usePerformanceReport = (projectId: string) =>
  useQuery({
    queryKey: reportKeys.performance(projectId),
    queryFn: async () => (await apiClient.get<PerformanceReport>('/reports/performance', { params: { projectId } })).data,
  });

export const exportProject = (projectId: string, format: ExportFormat) =>
  downloadFile(`/projects/${projectId}/export`, { format }, `project.${format}`);

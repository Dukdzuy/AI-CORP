import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface AgentCostBreakdown {
  agentRole: string;
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  totalCost: number;
  requestCount: number;
  rtkTokensSaved: number;
}

export interface ModelUsage {
  model: string;
  provider: string;
  requestCount: number;
  totalTokens: number;
  cost: number;
  fallbackTriggered: number;
}

export interface CostSummary {
  totalCost: number;
  totalTokens: number;
  rtkTokensSaved: number;
  byAgent: AgentCostBreakdown[];
  byModel: ModelUsage[];
  costOverTime: { date: string; cost: number; tokens: number }[];
}

export const costKeys = {
  all: ['cost'] as const,
  summary: (projectId?: string) => [...costKeys.all, 'summary', { projectId }] as const,
};

const fetchCostSummary = async (projectId?: string): Promise<CostSummary> => {
  try {
    const params = projectId ? { projectId } : {};
    const { data } = await apiClient.get<CostSummary>('/cost/summary', { params });
    return data;
  } catch {
    return {
      totalCost: 0,
      totalTokens: 0,
      rtkTokensSaved: 0,
      byAgent: [],
      byModel: [],
      costOverTime: [],
    };
  }
};

export const useCostSummary = (projectId?: string) => {
  return useQuery({
    queryKey: costKeys.summary(projectId),
    queryFn: () => fetchCostSummary(projectId),
    staleTime: 30_000,
  });
};

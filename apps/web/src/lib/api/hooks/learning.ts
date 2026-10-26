import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../client';

export interface LearningStats {
  role: string;
  outcomes: number;
  successes: number;
  successRate: number | null;
  timeline: Array<{ date: string; total: number; successes: number; successRate: number }>;
  bySignal: Record<string, { total: number; successes: number }>;
  lessons: Array<{ id: string; content: string; importance: number; createdAt: string }>;
  recentOutcomes: Array<{ content: string; success: boolean; signal: string; createdAt: string }>;
}

export const learningKeys = {
  stats: (role: string) => ['learning', role] as const,
};

export const useAgentLearning = (role: string) =>
  useQuery({
    queryKey: learningKeys.stats(role),
    queryFn: async () => (await apiClient.get<LearningStats>(`/agents/${role.toLowerCase()}/learning`)).data,
    enabled: !!role,
    staleTime: 60 * 1000,
  });

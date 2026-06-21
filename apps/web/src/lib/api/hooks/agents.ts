import { useQuery } from '@tanstack/react-query';
import { AgentRole } from '@ai-corp/shared-types';
import { apiClient } from '../client';

export interface AgentInfo {
  id: string;
  role: AgentRole;
  name: string;
  isActive: boolean;
}

const DEFAULT_AGENTS: AgentInfo[] = [
  { id: 'ceo', role: AgentRole.CEO, name: 'CEO Agent', isActive: true },
  { id: 'pm', role: AgentRole.PM, name: 'PM Agent', isActive: true },
  { id: 'dev', role: AgentRole.DEV, name: 'Dev Agent', isActive: true },
  { id: 'qa', role: AgentRole.QA, name: 'QA Agent', isActive: true },
  { id: 'marketing', role: AgentRole.MARKETING, name: 'Marketing Agent', isActive: true },
];

export const agentKeys = {
  all: ['agents'] as const,
  lists: () => [...agentKeys.all, 'list'] as const,
};

const fetchAgents = async (): Promise<AgentInfo[]> => {
  try {
    const { data } = await apiClient.get<AgentInfo[]>('/agents');
    return data;
  } catch {
    return DEFAULT_AGENTS;
  }
};

export const useAgents = () => {
  return useQuery({
    queryKey: agentKeys.lists(),
    queryFn: fetchAgents,
    staleTime: 5 * 60 * 1000,
  });
};

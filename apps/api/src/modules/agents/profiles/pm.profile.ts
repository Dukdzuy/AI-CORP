import { AgentRole } from '@ai-corp/shared-types';
import { RoleProfile } from './role-profile';

export const PM_PROFILE = RoleProfile.create({
  role: AgentRole.PM,
  displayName: 'Project Manager Agent',
  systemPrompt: `You are the Project Manager of a virtual tech company. Your role is to:
1. Turn the approved use cases (or milestones) into specific, actionable developer tasks
2. Keep the use case id in every task so work stays traceable
3. Order tasks by priority and estimate their complexity
4. Organize tasks on the Kanban board (todo, in_progress, review, done)

You should be organized, detail-oriented, and focus on execution.`,
  defaultModel: {
    provider: 'opencode',
    model: 'openrouter/openrouter/free',
    fallbackProvider: 'opencode',
    tags: ['planning', 'execution'],
  },
  memoryNamespaces: ['task_breakdown'],
  taskTypes: ['breakdownTasks'],
});

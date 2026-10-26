import { AgentRole } from '@ai-corp/shared-types';
import { RoleProfile } from './role-profile';

export const BA_PROFILE = RoleProfile.create({
  role: AgentRole.BA,
  displayName: 'Business Analyst Agent',
  systemPrompt: `You are the Business Analyst of a virtual tech company. Your role is to:
1. Analyze the project goal and identify the actors
2. Write structured use cases (pre/post-conditions, main, alternative and exception flows)
3. Produce the use case diagram
4. Keep requirements clear, testable and traceable (UC-001, UC-002, ...)

You should be precise, user-focused and complete.`,
  defaultModel: {
    provider: 'opencode',
    model: 'openrouter/openrouter/free',
    fallbackProvider: 'opencode',
    tags: ['analysis', 'requirements', 'ooad'],
  },
  memoryNamespaces: ['requirements_analysis'],
  taskTypes: ['generateUseCases', 'clarifyUseCase'],
});

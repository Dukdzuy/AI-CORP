import { AgentRole } from '@ai-corp/shared-types';
import { RoleProfile } from './role-profile';

export const DEV_PROFILE = RoleProfile.create({
  role: AgentRole.DEV,
  displayName: 'Developer Agent',
  systemPrompt: `You are a Senior Developer of a virtual tech company. Your role is to:
1. Implement the approved design: fill in the layered skeleton the Architect generated
2. Write clean, complete, runnable code (no placeholders)
3. Mark every application service method with the use case it implements (// UC-xxx)
4. Respect the layering rules: the domain layer imports nothing from outer layers

You should be technical, detail-oriented, and focused on code quality.`,
  defaultModel: {
    provider: 'opencode',
    model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free',
    fallbackProvider: 'opencode',
    tags: ['implementation', 'technical'],
  },
  memoryNamespaces: ['coding_conventions'],
  taskTypes: ['implement', 'planImplementation'],
});

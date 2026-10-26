import { AgentRole } from '@ai-corp/shared-types';
import { RoleProfile } from './role-profile';

export const ARCHITECT_PROFILE = RoleProfile.create({
  role: AgentRole.ARCHITECT,
  displayName: 'Software Architect Agent',
  systemPrompt: `You are the Software Architect of a virtual tech company. Your role is to:
1. Derive the domain model (entities, value objects, aggregates) from the use cases
2. Choose a layered architecture and the design patterns that fit
3. Produce class and sequence diagrams
4. Generate the layered code skeleton the developers fill in

You should be pragmatic, principled (SOLID, DDD) and explain every design decision.`,
  defaultModel: {
    provider: 'opencode',
    model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free',
    fallbackProvider: 'opencode',
    tags: ['design', 'architecture', 'ooad'],
  },
  memoryNamespaces: ['architecture_patterns'],
  taskTypes: ['designArchitecture', 'reviewPlan', 'reviewCode'],
});

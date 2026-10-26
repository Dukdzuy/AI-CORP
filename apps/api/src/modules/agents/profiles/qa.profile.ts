import { AgentRole } from '@ai-corp/shared-types';
import { RoleProfile } from './role-profile';

export const QA_PROFILE = RoleProfile.create({
  role: AgentRole.QA,
  displayName: 'Quality Assurance Agent',
  systemPrompt: `You are the QA (Quality Assurance) Engineer of a virtual tech company. Your role is to:
1. Own the OOAD quality gate between design and implementation
2. Review code against the approved use cases, domain model and design patterns
3. Check layering rules and SOLID principles
4. Take the QC verification report into account before approving
5. Approve the work or send it back with concrete findings

You should be meticulous, process-minded and focused on preventing defects. Be thorough but fair.`,
  defaultModel: {
    provider: 'opencode',
    model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free',
    fallbackProvider: 'opencode',
    tags: ['process', 'review', 'quality'],
  },
  memoryNamespaces: ['review_checklist'],
  taskTypes: ['review'],
});

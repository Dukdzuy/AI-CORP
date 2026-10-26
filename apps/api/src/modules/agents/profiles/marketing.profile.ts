import { AgentRole } from '@ai-corp/shared-types';
import { RoleProfile } from './role-profile';

export const MARKETING_PROFILE = RoleProfile.create({
  role: AgentRole.MARKETING,
  displayName: 'Marketing Agent',
  systemPrompt: `You are the Marketing Manager of a virtual tech company. Your role is to:
1. Create compelling marketing messages and announcements
2. Draft product release announcements
3. Write blog posts and thought leadership content
4. Develop go-to-market strategies

You should be creative, persuasive, and focused on audience engagement.`,
  defaultModel: {
    provider: 'opencode',
    model: 'openrouter/openrouter/owl-alpha',
    fallbackProvider: 'opencode',
    tags: ['marketing', 'content'],
  },
  memoryNamespaces: ['brand_voice'],
  taskTypes: ['draftAnnouncement'],
});

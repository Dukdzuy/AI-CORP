import { AgentRole } from '@ai-corp/shared-types';
import { ROLE_PROFILES, RoleProfile, CEO_PROFILE } from '../../../src/modules/agents/profiles';
import { DEFAULT_WORKFLOW_DEFINITION } from '../../../src/modules/workflow/default-workflow';

describe('RoleProfile', () => {
  const props = {
    role: AgentRole.DEV,
    displayName: 'Developer Agent',
    systemPrompt: 'You write code.',
    defaultModel: { provider: 'opencode', model: 'm1', tags: ['a'] },
    memoryNamespaces: ['coding_conventions', 'lessons_learned'],
    taskTypes: ['implement', 'fix'],
  };

  it('exposes the primary namespace and default task type', () => {
    const profile = RoleProfile.create(props);
    expect(profile.primaryNamespace).toBe('coding_conventions');
    expect(profile.defaultTaskType).toBe('implement');
  });

  it('resolves supported task types and falls back to the default otherwise', () => {
    const profile = RoleProfile.create(props);
    expect(profile.resolveTaskType('fix')).toBe('fix');
    expect(profile.resolveTaskType('deploy')).toBe('implement');
    expect(profile.resolveTaskType(undefined)).toBe('implement');
  });

  it('is immutable and hands out copies of its model config', () => {
    const profile = RoleProfile.create(props);
    const config = profile.modelConfig();
    config.model = 'changed';
    config.tags!.push('b');
    expect(profile.defaultModel.model).toBe('m1');
    expect(profile.defaultModel.tags).toEqual(['a']);
    expect(Object.isFrozen(profile)).toBe(true);
    expect(() => (profile.memoryNamespaces as string[]).push('x')).toThrow();
  });

  it('omits optional model fields that are not set', () => {
    expect(RoleProfile.create({ ...props, defaultModel: { provider: 'p', model: 'm' } }).modelConfig()).toEqual({ provider: 'p', model: 'm' });
  });

  it.each([
    ['displayName', { displayName: ' ' }],
    ['systemPrompt', { systemPrompt: '' }],
    ['defaultModel', { defaultModel: { provider: 'p', model: '' } }],
    ['memoryNamespaces', { memoryNamespaces: [] }],
    ['taskTypes', { taskTypes: [] }],
  ])('rejects a profile without %s', (_field, override) => {
    expect(() => RoleProfile.create({ ...props, ...override } as any)).toThrow();
  });

  it('compares by role', () => {
    expect(RoleProfile.create(props).equals(RoleProfile.create({ ...props, displayName: 'Other' }))).toBe(true);
    expect(RoleProfile.create(props).equals(CEO_PROFILE)).toBe(false);
  });
});

describe('ROLE_PROFILES', () => {
  it('defines exactly the 8 roles of the roster, once each', () => {
    const roles = ROLE_PROFILES.map(p => p.role);
    expect(new Set(roles).size).toBe(roles.length);
    expect([...roles].sort()).toEqual(
      [AgentRole.CEO, AgentRole.BA, AgentRole.ARCHITECT, AgentRole.PM, AgentRole.DEV, AgentRole.QC, AgentRole.QA, AgentRole.MARKETING].sort()
    );
    expect(roles).not.toContain('DEVOPS');
  });

  it('supports every task type the default workflow assigns to the role', () => {
    const agentNodes = DEFAULT_WORKFLOW_DEFINITION.nodes.filter(n => n.type === 'agent_task');
    for (const node of agentNodes) {
      const profile = ROLE_PROFILES.find(p => p.role === node.agentRole);
      expect(profile).toBeDefined();
      expect(profile!.supportsTaskType(node.taskType)).toBe(true);
    }
  });
});

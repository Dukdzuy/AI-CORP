import { describe, expect, it } from 'vitest';
import { InstantiatedWorkflow } from '@ai-corp/shared-types';
import { parameterDefaults, templateOutline } from '../templateOutline';

const instance: InstantiatedWorkflow = {
  templateId: 't',
  parameters: {},
  definition: {
    id: 'main', name: 'main', version: '1.0.0+a', startNode: 'start', endNode: 'end',
    nodes: [
      { id: 'end', type: 'agent_task', agentRole: 'CEO' as any },
      { id: 'start', type: 'agent_task', agentRole: 'CEO' as any },
      { id: 'build', type: 'sub_workflow', subWorkflowId: 'bv', subWorkflowVersion: '1.0.0+b' },
      { id: 'approval', type: 'human_approval' },
    ],
    edges: [
      { from: 'start', to: 'build' },
      { from: 'build', to: 'approval' },
      { from: 'approval', to: 'end', condition: 'onApprove' },
    ],
  },
  subWorkflows: [{
    id: 'bv', name: 'bv', version: '1.0.0+b', startNode: 'develop', endNode: 'check',
    nodes: [
      { id: 'develop', type: 'agent_task', agentRole: 'DEV' as any },
      { id: 'fan', type: 'parallel', metadata: { branches: [{ nodeId: 'review' }, { nodeId: 'market' }] } },
      { id: 'review', type: 'agent_task', agentRole: 'QA' as any },
      { id: 'market', type: 'agent_task', agentRole: 'MARKETING' as any },
      { id: 'check', type: 'condition' },
    ],
    edges: [
      { from: 'develop', to: 'fan' },
      { from: 'fan', to: 'check' },
      { from: 'check', to: 'develop', condition: 'onFail' },
    ],
  }],
};

describe('templateOutline', () => {
  it('lists nodes in execution order with sub-workflows and parallel branches nested', () => {
    expect(templateOutline(instance).map(r => `${'-'.repeat(r.depth)}${r.label}`)).toEqual([
      'start', 'build', '-develop', '-fan', '--review', '--market', '-check', 'approval', 'end',
    ]);
  });
});

describe('parameterDefaults', () => {
  it('collects the default values', () => {
    expect(parameterDefaults([
      { name: 'a', type: 'number', label: 'A', description: '', required: false, defaultValue: 3 },
      { name: 'b', type: 'string', label: 'B', description: '', required: true },
    ])).toEqual({ a: 3 });
  });
});

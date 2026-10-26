import { WorkflowDefinition } from '@ai-corp/shared-types';
import { WorkflowDefinitionRegistry, WorkflowVersionConflictError } from '../../../src/modules/workflow/workflow-definition.registry';
import { SubWorkflowStrategy } from '../../../src/modules/workflow/strategies/sub-workflow.strategy';
import { agentNode, createEngine, linear, waitForStatus } from './engine-harness';

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({ add: jest.fn(), close: jest.fn(), on: jest.fn() })),
  Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn() })),
}));

beforeAll(() => {
  process.env.REDIS_PORT = '1'; // nothing listens there: the engine runs nodes directly
  SubWorkflowStrategy.retryDelayMs = 0;
});
afterEach(() => jest.restoreAllMocks());

const reviewSub = (version = '1.0.0'): WorkflowDefinition => linear('review-sub', [
  agentNode('implement', 'DEV'),
  agentNode('review', 'QA'),
  {
    id: 'approved',
    type: 'condition',
    metadata: { variable: 'qa_approved', operator: 'equals', value: true },
  },
], [{ from: 'approved', to: 'implement', condition: 'onFail' }], version);

const parent = (subNodeMetadata: Record<string, unknown> = {}): WorkflowDefinition => linear('parent', [
  agentNode('plan', 'PM'),
  { id: 'build', type: 'sub_workflow', subWorkflowId: 'review-sub', maxRetries: 0, metadata: subNodeMetadata },
  agentNode('close', 'CEO'),
]);

describe('WorkflowDefinitionRegistry (Tasks 16, 17)', () => {
  it('keeps every version and resolves the latest by precedence', () => {
    const registry = new WorkflowDefinitionRegistry();
    registry.register(reviewSub('1.0.0'));
    registry.register(reviewSub('1.2.0'));
    registry.register(reviewSub('1.10.0'));

    expect(registry.get('review-sub')!.version).toBe('1.10.0');
    expect(registry.get('review-sub', '1.2.0')!.version).toBe('1.2.0');
    expect(registry.versionsOf('review-sub').map(d => d.version)).toEqual(['1.0.0', '1.2.0', '1.10.0']);
  });

  it('treats a version as immutable: same content is a no-op, other content is rejected', () => {
    const registry = new WorkflowDefinitionRegistry();
    const first = registry.register(reviewSub());
    expect(registry.register(JSON.parse(JSON.stringify(reviewSub())))).toBe(first);

    const changed = reviewSub();
    changed.nodes[0].taskType = 'something-else';
    expect(() => registry.register(changed)).toThrow(WorkflowVersionConflictError);
  });

  it('pins sub-workflow references to the version registered at that time', () => {
    const registry = new WorkflowDefinitionRegistry();
    registry.register(reviewSub('1.0.0'));
    const registered = registry.register(parent());
    registry.register(reviewSub('2.0.0'));

    expect(registered.nodes.find(n => n.id === 'build')!.subWorkflowVersion).toBe('1.0.0');
  });

  it('rejects a workflow that calls itself, unknown sub-workflows and pausing sub-workflows', () => {
    const registry = new WorkflowDefinitionRegistry();
    const selfCalling = linear('loop', [
      agentNode('a', 'DEV'),
      { id: 'again', type: 'sub_workflow', subWorkflowId: 'loop' },
    ]);
    expect(() => registry.register(selfCalling)).toThrow(/call itself/);
    expect(() => registry.register(parent())).toThrow(/unknown workflow review-sub/);

    registry.register(linear('with-approval', [agentNode('a', 'DEV'), { id: 'ok', type: 'human_approval' }]));
    const usesApproval = linear('p2', [{ id: 'sub', type: 'sub_workflow', subWorkflowId: 'with-approval' }]);
    expect(() => registry.register(usesApproval)).toThrow(/human_approval/);
  });

  it('rejects parallel nodes with cyclic or unknown branches', () => {
    const registry = new WorkflowDefinitionRegistry();
    const def = (branches: unknown) => linear('par', [
      { id: 'fan', type: 'parallel', metadata: { branches } },
    ]).nodes.concat([agentNode('x', 'DEV'), agentNode('y', 'QA')]);
    const cyclic: WorkflowDefinition = { ...linear('par', [{ id: 'fan', type: 'parallel' }]), nodes: def([{ nodeId: 'x', dependsOn: ['y'] }, { nodeId: 'y', dependsOn: ['x'] }]) };
    expect(() => registry.register(cyclic)).toThrow(/cyclic dependency/);
    const unknown: WorkflowDefinition = { ...cyclic, nodes: def([{ nodeId: 'nope' }]) };
    expect(() => registry.register(unknown)).toThrow(/unknown node nope/);
  });
});

describe('Sub-workflow execution (Task 16)', () => {
  const approvingAgents = (role: string, input: Record<string, any>) => {
    if (role === 'QA') return { qa_approved: true, review: 'ok' };
    if (role === 'DEV') return { code: `v${(input.attempt || 0) + 1}`, scratch: 'dev-only' };
    return { output: `${role} done` };
  };

  it('runs the child as its own run inside the parent node and returns its variables', async () => {
    const { engine, repository, calls } = createEngine(approvingAgents);
    engine.createWorkflow(reviewSub());
    engine.createWorkflow(parent());

    const run = await engine.startWorkflow('p1', 'parent', { projectId: 'p1', variables: { goal: 'shop' } });
    const done = await waitForStatus(repository, run.id, ['completed', 'failed']);

    expect(done.status).toBe('completed');
    expect(calls.map(c => c.role)).toEqual(['PM', 'DEV', 'QA', 'CEO']);

    const [child] = await repository.findChildRuns(run.id);
    expect(child).toEqual(expect.objectContaining({
      workflowDefId: 'review-sub', workflowDefVersion: '1.0.0', parentNodeId: 'build', status: 'completed',
    }));
    // Child nodes are steps of the child run; the parent only has its own nodes
    expect((await repository.findStepsByRun(child.id)).map(s => s.nodeId)).toEqual(['implement', 'review', 'approved']);
    expect((await repository.findStepsByRun(run.id)).map(s => s.nodeId)).toEqual(['plan', 'build', 'close']);
    expect((done.context as any).variables).toEqual(expect.objectContaining({ goal: 'shop', qa_approved: true, code: 'v1' }));
  });

  it('isolates the child context: only inputs go in, only outputs come back', async () => {
    const seen: Record<string, unknown>[] = [];
    const { engine, repository } = createEngine((role, input) => {
      if (role === 'DEV') seen.push({ secret: input.secret, spec: input.spec });
      return approvingAgents(role, input);
    });
    engine.createWorkflow(reviewSub());
    engine.createWorkflow(parent({ inputs: ['spec'], outputs: ['code'] }));

    const run = await engine.startWorkflow('p1', 'parent', { projectId: 'p1', variables: { spec: 'UC-1', secret: 'parent-only' } });
    const done = await waitForStatus(repository, run.id, ['completed', 'failed']);

    expect(seen[0]).toEqual({ secret: undefined, spec: 'UC-1' });
    const vars = (done.context as any).variables;
    expect(vars.code).toBe('v1');
    expect(vars).not.toHaveProperty('qa_approved');
    expect(vars).not.toHaveProperty('scratch');
    expect(vars.secret).toBe('parent-only');
  });

  it('loops inside the child on a rejected review, then completes', async () => {
    let reviews = 0;
    const { engine, repository, calls } = createEngine(role => {
      if (role === 'QA') return { qa_approved: ++reviews > 1 };
      return { output: role };
    });
    engine.createWorkflow(reviewSub());
    engine.createWorkflow(parent());

    const run = await engine.startWorkflow('p1', 'parent', { projectId: 'p1', variables: {} });
    expect((await waitForStatus(repository, run.id, ['completed', 'failed'])).status).toBe('completed');
    expect(calls.map(c => c.role)).toEqual(['PM', 'DEV', 'QA', 'DEV', 'QA', 'CEO']);
  });

  it('fails the parent node and leaves the parent context untouched when the child fails', async () => {
    const { engine, repository, calls } = createEngine(role => {
      if (role === 'DEV') throw new Error('compiler exploded');
      return { output: role, leaked: true };
    });
    engine.createWorkflow(reviewSub());
    engine.createWorkflow(parent());

    const run = await engine.startWorkflow('p1', 'parent', { projectId: 'p1', variables: { keep: 1 } });
    const done = await waitForStatus(repository, run.id, ['completed', 'failed'], 15000);

    expect(done.status).toBe('failed');
    expect(done.currentNodeId).toBe('build');
    expect(calls.some(c => c.role === 'CEO')).toBe(false);
    const children = await repository.findChildRuns(run.id);
    expect(children.length).toBeGreaterThan(0);
    expect(children.every(c => c.status === 'failed')).toBe(true);
    // Only the parent's own PM node wrote to it; nothing from the failed child came back
    expect((done.context as any).variables).toEqual({ keep: 1, output: 'PM', leaked: true });
  }, 20000);

  it('stops runaway nesting at run time', async () => {
    const { engine, repository } = createEngine(() => ({ output: 'x' }));
    engine.createWorkflow(reviewSub());
    const strategy = new SubWorkflowStrategy(engine, repository, { sendToProject: jest.fn() } as any);
    const run = await repository.createRun({
      projectId: 'p1', workflowDefId: 'parent', status: 'running', currentNodeId: 'build',
      context: { variables: {}, _subWorkflowDepth: SubWorkflowStrategy.MAX_DEPTH },
    });
    const ctx = {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() } as any,
      getDefinition: (id: string, v?: string | null) => engine.getDefinition(id, v),
      definitionOf: () => undefined,
      executeNode: jest.fn(),
    };

    const result = await strategy.execute({ id: 'build', type: 'sub_workflow', subWorkflowId: 'review-sub' }, run, ctx);
    expect(result.status).toBe('failure');
    expect(result.error).toMatch(/nesting deeper than 5/);
    expect(ctx.executeNode).not.toHaveBeenCalled();
  });
});

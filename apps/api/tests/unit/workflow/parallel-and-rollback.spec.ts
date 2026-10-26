import { WorkflowDefinition } from '@ai-corp/shared-types';
import { agentNode, createEngine, InMemoryWorkflowEngineRepository, linear, waitForStatus } from './engine-harness';

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({ add: jest.fn(), close: jest.fn(), on: jest.fn() })),
  Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn() })),
}));

beforeAll(() => {
  process.env.REDIS_PORT = '1';
});
afterEach(() => jest.restoreAllMocks());

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/** start → fan (parallel branches) → end; branch nodes are only reachable through the fan */
function fanOut(branches: unknown, concurrencyLimit?: number): WorkflowDefinition {
  return {
    id: 'fan-out',
    name: 'fan-out',
    version: '1.0.0',
    startNode: 'fan',
    endNode: 'end',
    nodes: [
      { id: 'fan', type: 'parallel', maxRetries: 0, metadata: { branches, concurrencyLimit } },
      agentNode('design', 'ARCHITECT'),
      agentNode('implement', 'DEV'),
      agentNode('test', 'QC'),
      agentNode('announce', 'MARKETING'),
      agentNode('end', 'CEO'),
    ],
    edges: [{ from: 'fan', to: 'end' }],
  };
}

/** Records how many agents run at once and when each starts and ends */
function timedAgents(durations: Record<string, number>, failing: string[] = []) {
  let active = 0;
  const trace = { maxActive: 0, events: [] as string[] };
  const script = async (role: string) => {
    active++;
    trace.maxActive = Math.max(trace.maxActive, active);
    trace.events.push(`start ${role}`);
    await sleep(durations[role] ?? 0);
    trace.events.push(`end ${role}`);
    active--;
    if (failing.includes(role)) throw new Error(`${role} failed`);
    return { [`${role.toLowerCase()}_done`]: true };
  };
  return { script, trace };
}

describe('Parallel execution with dependencies (Task 18)', () => {
  it('starts a branch only after its dependencies finished', async () => {
    const { script, trace } = timedAgents({ ARCHITECT: 30, DEV: 10, QC: 10, MARKETING: 5 });
    const { engine, repository } = createEngine(script);
    engine.createWorkflow(fanOut([
      { nodeId: 'design' },
      { nodeId: 'implement', dependsOn: ['design'] },
      { nodeId: 'test', dependsOn: ['implement'] },
      { nodeId: 'announce' },
    ]));

    const run = await engine.startWorkflow('p1', 'fan-out', { projectId: 'p1', variables: {} });
    const done = await waitForStatus(repository, run.id, ['completed', 'failed']);

    expect(done.status).toBe('completed');
    const at = (e: string) => trace.events.indexOf(e);
    expect(at('start DEV')).toBeGreaterThan(at('end ARCHITECT'));
    expect(at('start QC')).toBeGreaterThan(at('end DEV'));
    // Independent branches overlap: Marketing starts before the Architect is done
    expect(at('start MARKETING')).toBeLessThan(at('end ARCHITECT'));
    // Every branch's output reached the shared run variables
    expect((done.context as any).variables).toEqual(expect.objectContaining({
      architect_done: true, dev_done: true, qc_done: true, marketing_done: true, ceo_done: true,
    }));
  });

  it('reports layers and a per-branch timeline', async () => {
    const { script } = timedAgents({ ARCHITECT: 10 });
    const { engine, repository } = createEngine(script);
    engine.createWorkflow(fanOut([{ nodeId: 'design' }, { nodeId: 'implement', dependsOn: ['design'] }]));

    const run = await engine.startWorkflow('p1', 'fan-out', { projectId: 'p1', variables: {} });
    await waitForStatus(repository, run.id, ['completed']);
    const fanStep = repository.steps.find(s => s.nodeId === 'fan')!;
    const output = JSON.parse(fanStep.output!);

    expect(output.layers).toEqual([['design'], ['implement']]);
    expect(output.results.map((r: any) => [r.nodeId, r.status, r.layer])).toEqual([['design', 'success', 0], ['implement', 'success', 1]]);
    const [design, implement] = output.results;
    expect(new Date(implement.startedAt).getTime()).toBeGreaterThanOrEqual(new Date(design.finishedAt).getTime());
    expect(design.durationMs).toBeGreaterThanOrEqual(5);
  });

  it('never runs more branches at once than the concurrency limit', async () => {
    const { script, trace } = timedAgents({ ARCHITECT: 15, DEV: 15, QC: 15, MARKETING: 15 });
    const { engine, repository } = createEngine(script);
    engine.createWorkflow(fanOut([{ nodeId: 'design' }, { nodeId: 'implement' }, { nodeId: 'test' }, { nodeId: 'announce' }], 2));

    const run = await engine.startWorkflow('p1', 'fan-out', { projectId: 'p1', variables: {} });
    await waitForStatus(repository, run.id, ['completed']);
    expect(trace.maxActive).toBe(2);
  });

  it('is faster than running the same branches one after another', async () => {
    const { script } = timedAgents({ ARCHITECT: 60, DEV: 60, QC: 60 });
    const { engine, repository } = createEngine(script);
    engine.createWorkflow(fanOut([{ nodeId: 'design' }, { nodeId: 'implement' }, { nodeId: 'test' }]));

    const started = Date.now();
    const run = await engine.startWorkflow('p1', 'fan-out', { projectId: 'p1', variables: {} });
    await waitForStatus(repository, run.id, ['completed']);
    // Sequential would take >= 180 ms
    expect(Date.now() - started).toBeLessThan(170);
  });

  it('skips the dependents of a failed branch and fails the node', async () => {
    const { script, trace } = timedAgents({}, ['ARCHITECT']);
    const { engine, repository } = createEngine(script);
    engine.createWorkflow(fanOut([
      { nodeId: 'design' },
      { nodeId: 'implement', dependsOn: ['design'] },
      { nodeId: 'announce' },
    ]));

    const run = await engine.startWorkflow('p1', 'fan-out', { projectId: 'p1', variables: {} });
    const done = await waitForStatus(repository, run.id, ['completed', 'failed'], 15000);

    expect(done.status).toBe('failed');
    expect(trace.events).not.toContain('start DEV');
    expect(trace.events).toContain('end MARKETING');
  }, 20000);

  it('rejects a definition whose branches depend on each other in a cycle', () => {
    const { engine } = createEngine(() => ({}));
    expect(() => engine.createWorkflow(fanOut([
      { nodeId: 'design', dependsOn: ['test'] },
      { nodeId: 'test', dependsOn: ['design'] },
    ]))).toThrow(/cyclic dependency/);
  });
});

describe('Snapshots and rollback (Task 17)', () => {
  const pipeline = () => linear('pipeline', [
    agentNode('analyze', 'BA'),
    agentNode('design', 'ARCHITECT'),
    agentNode('implement', 'DEV'),
    agentNode('close', 'CEO'),
  ]);

  /** DEV fails until `fixed` is set */
  function flakyDev() {
    const state = { fixed: false, devCalls: 0 };
    const script = (role: string) => {
      if (role === 'DEV') {
        state.devCalls++;
        if (!state.fixed) throw new Error('build broke');
      }
      return { [`${role.toLowerCase()}_output`]: `${role} v${state.devCalls}` };
    };
    return { state, script };
  }

  it('snapshots the run before every node and keeps them across a restart', async () => {
    const { script } = flakyDev();
    const { engine, repository } = createEngine(script);
    engine.createWorkflow(pipeline());
    const run = await engine.startWorkflow('p1', 'pipeline', { projectId: 'p1', variables: { seed: 1 } });
    const failed = await waitForStatus(repository, run.id, ['failed', 'completed']);

    expect(failed.status).toBe('failed');
    expect(failed.currentNodeId).toBe('implement');

    // "Restart": a new engine over the same storage
    const restarted = createEngine(script, repository);
    restarted.engine.createWorkflow(pipeline());
    const snapshots = await restarted.engine.listSnapshots(run.id);
    expect(snapshots.map(s => [s.sequence, s.nodeId])).toEqual([[1, 'analyze'], [2, 'design'], [3, 'implement']]);
  });

  it('rolls a failed run back to before the failing node, then resumes to completion', async () => {
    const { state, script } = flakyDev();
    const { engine, repository } = createEngine(script);
    engine.createWorkflow(pipeline());
    const run = await engine.startWorkflow('p1', 'pipeline', { projectId: 'p1', variables: {} });
    await waitForStatus(repository, run.id, ['failed']);

    const { run: rolledBack, snapshot } = await engine.rollbackWorkflow(run.id, { steps: 1 });
    expect(snapshot.nodeId).toBe('implement');
    expect(rolledBack.status).toBe('paused');
    expect(rolledBack.currentNodeId).toBe('implement');
    expect(rolledBack.completedAt).toBeNull();
    expect((rolledBack.context as any).variables).toEqual({ ba_output: 'BA v0', architect_output: 'ARCHITECT v0' });

    state.fixed = true;
    await engine.resumeWorkflow(run.id);
    const done = await waitForStatus(repository, run.id, ['completed', 'failed']);
    expect(done.status).toBe('completed');
    // The re-run node was snapshotted again under the same sequence number
    expect((await engine.listSnapshots(run.id)).map(s => s.nodeId)).toEqual(['analyze', 'design', 'implement', 'close']);
  });

  it('restores the earlier context when rolling back several steps, discarding later snapshots', async () => {
    const { script } = flakyDev();
    const { engine, repository } = createEngine(script);
    engine.createWorkflow(pipeline());
    const run = await engine.startWorkflow('p1', 'pipeline', { projectId: 'p1', variables: { seed: 1 } });
    await waitForStatus(repository, run.id, ['failed']);

    const { run: rolledBack } = await engine.rollbackWorkflow(run.id, { steps: 2 });
    expect(rolledBack.currentNodeId).toBe('design');
    expect((rolledBack.context as any).variables).toEqual({ seed: 1, ba_output: 'BA v0' });
    expect((await engine.listSnapshots(run.id)).map(s => s.nodeId)).toEqual(['analyze']);
  });

  it('rolls back to a chosen snapshot and cancels the pending approval it leaves behind', async () => {
    const { engine, repository } = createEngine(role => ({ [`${role}`]: 'ok' }));
    const withApproval: WorkflowDefinition = {
      ...linear('approve-flow', [agentNode('design', 'ARCHITECT'), { id: 'approval', type: 'human_approval' }, agentNode('close', 'CEO')]),
      edges: [{ from: 'design', to: 'approval' }, { from: 'approval', to: 'close', condition: 'onApprove' }],
    };
    engine.createWorkflow(withApproval);
    const run = await engine.startWorkflow('p1', 'approve-flow', { projectId: 'p1', variables: {} });
    await waitForStatus(repository, run.id, ['paused']);
    expect(repository.approvals.map(a => a.status)).toEqual(['pending']);

    const [first] = await engine.listSnapshots(run.id);
    const result = await engine.rollbackWorkflow(run.id, { snapshotId: first.id });

    expect(result.run.currentNodeId).toBe('design');
    expect(result.cancelledApprovals).toBe(1);
    expect(repository.approvals.map(a => a.status)).toEqual(['cancelled']);
  });

  it('refuses to roll back a running run, a sub-workflow run, or further than its history', async () => {
    const repository = new InMemoryWorkflowEngineRepository();
    const { engine } = createEngine(() => ({}), repository);
    engine.createWorkflow(pipeline());
    const running = await repository.createRun({ projectId: 'p1', workflowDefId: 'pipeline', status: 'running', currentNodeId: 'design', context: {} });
    await expect(engine.rollbackWorkflow(running.id, { steps: 1 })).rejects.toThrow(/pause it first/);

    const child = await repository.createRun({ projectId: 'p1', workflowDefId: 'pipeline', parentRunId: running.id, status: 'failed', currentNodeId: 'design', context: {} });
    await expect(engine.rollbackWorkflow(child.id, { steps: 1 })).rejects.toThrow(/sub-workflow run/);

    const paused = await repository.createRun({ projectId: 'p1', workflowDefId: 'pipeline', status: 'paused', currentNodeId: 'design', context: {} });
    await expect(engine.rollbackWorkflow(paused.id, { steps: 1 })).rejects.toThrow(/no snapshots/);
  });
});

describe('Run versions (Task 17)', () => {
  it('keeps running the version a run started with after a newer version is registered', async () => {
    const { engine, repository, calls } = createEngine(role => ({ by: role }));
    const version = (v: string, lastRole: string): WorkflowDefinition => ({
      ...linear('flow', [agentNode('a', 'BA'), { id: 'approval', type: 'human_approval' }, agentNode('b', lastRole)], [], v),
      edges: [{ from: 'a', to: 'approval' }, { from: 'approval', to: 'b', condition: 'onApprove' }],
    });
    engine.createWorkflow(version('1.0.0', 'DEV'));
    const registered = engine.getDefinition('flow')!;
    expect(Object.isFrozen(registered.nodes[0])).toBe(true);

    const run = await engine.startWorkflow('p1', 'flow', { projectId: 'p1', variables: {} });
    expect(run.workflowDefVersion).toBe('1.0.0');
    await waitForStatus(repository, run.id, ['paused']);

    // v2 replaces DEV by QA; the paused v1 run must still go to DEV
    engine.createWorkflow(version('2.0.0', 'QA'));
    expect(engine.getDefinition('flow')!.version).toBe('2.0.0');

    await engine.resumeWorkflow(run.id, true);
    await engine.transitionToNextNode(run.id, 'onApprove');
    await engine.processCurrentNode(run.id);
    await waitForStatus(repository, run.id, ['completed', 'failed']);
    expect(calls.map(c => c.role)).toEqual(['BA', 'DEV']);
  });
});

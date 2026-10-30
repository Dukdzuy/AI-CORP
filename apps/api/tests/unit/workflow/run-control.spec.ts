import { agentNode, createEngine, linear, waitForStatus } from './engine-harness';
import { WorkflowBlockedError } from '../../../src/modules/workflow/workflow.engine';

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({ add: jest.fn(), close: jest.fn(), on: jest.fn() })),
  Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn() })),
}));

beforeAll(() => {
  process.env.REDIS_PORT = '1';
});
afterEach(() => jest.restoreAllMocks());

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const approvalNode = { id: 'approval', type: 'human_approval' as const, maxRetries: 0, metadata: { approvalType: 'release' } };

/** build → approval → (approved) ship | (rejected) build again */
const withApproval = () => ({
  ...linear('with-approval', [agentNode('build', 'DEV'), approvalNode, agentNode('ship', 'CEO')]),
  edges: [
    { from: 'build', to: 'approval' },
    { from: 'approval', to: 'ship', condition: 'onApprove' },
    { from: 'approval', to: 'build', condition: 'onReject' },
  ],
});

describe('Run control (review fixes, 2026-10-30)', () => {
  it('refuses to resume a run that waits for an approval, so no second approval is asked', async () => {
    const { engine, repository } = createEngine(() => ({ ok: true }));
    engine.createWorkflow(withApproval());

    const run = await engine.startWorkflow('p1', 'with-approval', { projectId: 'p1', variables: {} });
    const paused = await waitForStatus(repository, run.id, ['paused']);
    expect(paused.currentNodeId).toBe('approval');

    await expect(engine.resumeWorkflow(run.id)).rejects.toBeInstanceOf(WorkflowBlockedError);
    expect(repository.approvals.filter(a => a.status === 'pending')).toHaveLength(1);
  });

  it('hands the approval decision and its reason to the agents that run next', async () => {
    const { engine, repository, calls } = createEngine(() => ({ ok: true }));
    engine.createWorkflow(withApproval());

    const run = await engine.startWorkflow('p1', 'with-approval', { projectId: 'p1', variables: {} });
    await waitForStatus(repository, run.id, ['paused']);

    // What ApprovalService does on a rejection
    repository.approvals[0].status = 'rejected';
    await engine.recordApprovalDecision(run.id, 'rejected', 'Missing input validation');
    await engine.resumeWorkflow(run.id, true);
    await engine.transitionToNextNode(run.id, 'onReject');
    await engine.processCurrentNode(run.id);
    await waitForStatus(repository, run.id, ['paused']);

    const rework = calls.filter(c => c.role === 'DEV')[1];
    expect(rework.input).toEqual(expect.objectContaining({ approvalDecision: 'rejected', approvalFeedback: 'Missing input validation' }));
  });

  it('moves past a node that finished while the run was paused instead of running it again', async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => (release = resolve));
    const { engine, repository, calls } = createEngine(async role => {
      if (role === 'DEV') await gate;
      return { [`${role.toLowerCase()}_done`]: true };
    });
    engine.createWorkflow(linear('pause-mid-node', [agentNode('build', 'DEV'), agentNode('ship', 'CEO')]));

    const run = await engine.startWorkflow('p1', 'pause-mid-node', { projectId: 'p1', variables: {} });
    await sleep(20);
    await engine.pauseWorkflow(run.id);
    release();
    await sleep(30);
    expect((await repository.findRunById(run.id))!.status).toBe('paused');

    await engine.resumeWorkflow(run.id);
    const done = await waitForStatus(repository, run.id, ['completed', 'failed']);

    expect(done.status).toBe('completed');
    expect(calls.filter(c => c.role === 'DEV')).toHaveLength(1);
    expect((done.context as any)._finishedWhilePaused).toBeUndefined();
  });

  it('pauses before the next node once the budget is used up and refuses to resume until it is raised', async () => {
    const { engine, repository, calls } = createEngine(role => {
      if (role === 'DEV') repository.costAccrued = 12; // the LLM calls of this node cost more than the budget
      return { ok: true };
    });
    repository.budget = 10;
    engine.createWorkflow(linear('budget', [agentNode('build', 'DEV'), agentNode('ship', 'CEO')]));

    const run = await engine.startWorkflow('p1', 'budget', { projectId: 'p1', variables: {} });
    const paused = await waitForStatus(repository, run.id, ['paused']);
    expect(paused.currentNodeId).toBe('ship');
    expect(calls.map(c => c.role)).toEqual(['DEV']);

    await expect(engine.resumeWorkflow(run.id)).rejects.toThrow(/budget/i);

    repository.budget = 50;
    await engine.resumeWorkflow(run.id);
    const done = await waitForStatus(repository, run.id, ['completed', 'failed']);
    expect(done.status).toBe('completed');
  });

  it('cancels a run with its pending approvals, and a cancelled project is not marked completed', async () => {
    const { engine, repository } = createEngine(() => ({ ok: true }));
    engine.createWorkflow(withApproval());

    const run = await engine.startWorkflow('p1', 'with-approval', { projectId: 'p1', variables: {} });
    await waitForStatus(repository, run.id, ['paused']);

    await engine.cancelWorkflow(run.id, 'Project cancelled');
    expect((await repository.findRunById(run.id))!.status).toBe('cancelled');
    expect(repository.approvals.map(a => a.status)).toEqual(['cancelled']);

    repository.projectStatus = 'cancelled';
    await repository.completeProject();
    expect(repository.projectStatus).toBe('cancelled');
  });

  it('records the retry number on each attempt of a node', async () => {
    let attempts = 0;
    const { engine, repository } = createEngine(() => {
      attempts++;
      if (attempts === 1) throw new Error('flaky');
      return { ok: true };
    });
    jest.spyOn(engine as any, 'delay').mockResolvedValue(undefined);
    engine.createWorkflow(linear('retry', [agentNode('build', 'DEV', 'build', { maxRetries: 1 })]));

    const run = await engine.startWorkflow('p1', 'retry', { projectId: 'p1', variables: {} });
    await waitForStatus(repository, run.id, ['completed', 'failed']);

    expect(repository.steps.filter(s => s.nodeId === 'build').map(s => (s as any).retryCount)).toEqual([0, 1]);
  });
});

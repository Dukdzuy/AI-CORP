import { WorkflowDefinition } from '@ai-corp/shared-types';
import { ApprovalRequestedEvent } from '../../../src/domain/events/ApprovalRequestedEvent';
import { WorkflowFailedEvent } from '../../../src/domain/events/WorkflowFailedEvent';
import { agentNode, createEngine, linear, waitForStatus } from './engine-harness';

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({ add: jest.fn(), close: jest.fn(), on: jest.fn() })),
  Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn() })),
}));

beforeAll(() => {
  process.env.REDIS_PORT = '1';
});
afterEach(() => jest.restoreAllMocks());

const published = (events: { publish: jest.Mock }, type: Function) => events.publish.mock.calls.map(c => c[0]).filter(e => e instanceof type);

/** Phase 5: the engine raises the events the audit trail and webhooks rely on */
describe('workflow domain events (Phase 5)', () => {
  it('raises WorkflowFailedEvent when a node fails with no onFail edge', async () => {
    const { engine, repository, events } = createEngine(role => {
      if (role === 'DEV') throw new Error('build broke');
      return {};
    });
    engine.createWorkflow(linear('fails', [agentNode('design', 'ARCHITECT'), agentNode('develop', 'DEV'), agentNode('end', 'CEO')]));
    const run = await engine.startWorkflow('p1', 'fails', { projectId: 'p1', variables: {} });
    await waitForStatus(repository, run.id, ['failed']);

    const [failed] = published(events, WorkflowFailedEvent) as WorkflowFailedEvent[];
    expect(failed).toMatchObject({ eventType: 'workflow.failed', projectId: 'p1', workflowRunId: run.id, nodeId: 'develop' });
    expect(failed.reason).toBeTruthy();
  });

  it('raises ApprovalRequestedEvent when a run reaches a human approval node', async () => {
    const { engine, repository, events } = createEngine(() => ({}));
    const def: WorkflowDefinition = {
      ...linear('approve', [agentNode('build', 'DEV'), { id: 'approval', type: 'human_approval', maxRetries: 0, metadata: { approvalType: 'release' } } as any, agentNode('end', 'CEO')]),
      edges: [
        { from: 'build', to: 'approval' },
        { from: 'approval', to: 'end', condition: 'onApprove' },
      ],
    };
    engine.createWorkflow(def);
    const run = await engine.startWorkflow('p1', 'approve', { projectId: 'p1', variables: {} });
    await waitForStatus(repository, run.id, ['paused']);

    const [requested] = published(events, ApprovalRequestedEvent) as ApprovalRequestedEvent[];
    expect(requested).toMatchObject({ projectId: 'p1', workflowRunId: run.id, requestedBy: 'owner-1', approvalType: 'release' });
    expect(requested.approvalId).toBe(repository.approvals[0].id);
  });
});

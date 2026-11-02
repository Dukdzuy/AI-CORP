import { describe, expect, it } from 'vitest';
import { projectProgress } from '../projectProgress';

describe('projectProgress', () => {
  it('says when the workflow never started', () => {
    expect(projectProgress({ status: 'active' })).toEqual({ percent: 0, label: 'Workflow not started', tone: 'warning' });
    expect(projectProgress({ status: 'completed' })).toEqual({ percent: 100, label: 'Completed', tone: 'success' });
    expect(projectProgress({ status: 'cancelled' }).label).toBe('Cancelled');
  });

  it('takes the position from the run’s own workflow definition', () => {
    const run = { status: 'running', currentNodeId: 'develop', nodeIndex: 5, nodeCount: 12 };
    expect(projectProgress({ status: 'active', latestRun: run })).toEqual({ percent: 42, label: 'Running at develop', tone: 'active' });
  });

  it('shows a failed run as failed even while the project is still active', () => {
    const progress = projectProgress({ status: 'active', latestRun: { status: 'failed', currentNodeId: 'test', nodeIndex: 6, nodeCount: 12 } });
    expect(progress).toEqual({ percent: 50, label: 'Failed at test', tone: 'error' });
  });

  it('keeps the position of a paused run and reads project detail runs too', () => {
    expect(projectProgress({ status: 'paused', workflowRuns: [{ status: 'paused', currentNodeId: 'approval', nodeIndex: 10, nodeCount: 12 }] }))
      .toEqual({ percent: 83, label: 'Paused at approval', tone: 'warning' });
  });
});

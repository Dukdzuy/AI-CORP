import { describe, expect, it } from 'vitest';
import { projectProgress } from '../projectProgress';

describe('projectProgress', () => {
  it('uses the project status when the list has no runs', () => {
    expect(projectProgress({ status: 'completed' })).toEqual({ percent: 100, label: 'Completed' });
    expect(projectProgress({ status: 'paused' })).toEqual({ percent: 75, label: 'Paused' });
    expect(projectProgress({ status: 'cancelled' })).toEqual({ percent: 0, label: 'Cancelled' });
    expect(projectProgress({ status: 'active' })).toEqual({ percent: 0, label: 'Running' });
  });

  it('prefers the latest run', () => {
    expect(projectProgress({ status: 'active', workflowRuns: [{ status: 'failed' }] }).label).toBe('Failed');
    expect(projectProgress({ status: 'active', workflowRuns: [{ status: 'running', currentNodeId: 'build' }] })).toEqual({ percent: 33, label: 'Running: build' });
    expect(projectProgress({ status: 'active', workflowRuns: [{ status: 'running', currentNodeId: 'custom' }] }).percent).toBe(25);
  });

  it('falls back to the budget share for a running project with a budget', () => {
    expect(projectProgress({ status: 'active', budget: 10, costAccrued: 2.5 })).toEqual({ percent: 25, label: 'Running, 25% of budget' });
    expect(projectProgress({ status: 'active', budget: 1, costAccrued: 3 }).percent).toBe(100);
  });
});

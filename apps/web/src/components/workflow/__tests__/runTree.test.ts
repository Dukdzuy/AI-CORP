import { describe, expect, it } from 'vitest';
import { childRunsOf, ganttLayout, overlappingKeys, pathTo, timelineRows, WorkflowRunTree } from '../runTree';

const at = (s: number) => new Date(Date.UTC(2026, 9, 26, 6, 0, s)).toISOString();

function run(id: string, defId: string, nodes: Array<[string, string]>, steps: Array<[string, number, number, string?]>, children: WorkflowRunTree[] = [], parentNodeId: string | null = null, startedAt = 0): WorkflowRunTree {
  return {
    run: { id, projectId: 'p1', workflowDefId: defId, workflowDefVersion: '1.0.0', parentRunId: parentNodeId ? 'root' : null, parentNodeId, status: 'completed', currentNodeId: null, startedAt: at(startedAt), completedAt: null },
    definition: { id: defId, name: defId, version: '1.0.0', startNode: nodes[0][0], endNode: nodes[nodes.length - 1][0], edges: [], nodes: nodes.map(([nid, type]) => ({ id: nid, type: type as any })) },
    steps: steps.map(([nodeId, start, end, role]) => ({ id: `${id}-${nodeId}`, workflowRunId: id, nodeId, agentRole: role ?? null, status: 'completed', startedAt: at(start), completedAt: at(end) })),
    children,
  };
}

const child = run('child', 'build', [['develop', 'agent_task'], ['review', 'agent_task']], [['develop', 11, 15, 'DEV'], ['review', 15, 19, 'QA']], [], 'build', 11);
const tree = run('root', 'main', [['plan', 'agent_task'], ['build', 'sub_workflow'], ['close', 'agent_task']], [['plan', 0, 10, 'PM'], ['build', 10, 20], ['close', 20, 22, 'CEO']], [child]);

describe('timelineRows', () => {
  it('nests the child run under its sub_workflow step', () => {
    expect(timelineRows(tree).map(r => `${'  '.repeat(r.depth)}${r.label}`)).toEqual(['plan', 'build', '  develop', '  review', 'close']);
    expect(timelineRows(tree)[1]).toEqual(expect.objectContaining({ kind: 'sub_workflow', runId: 'child' }));
  });

  it('hides the child rows of a collapsed sub-workflow', () => {
    expect(timelineRows(tree, new Set(['root-build'])).map(r => r.label)).toEqual(['plan', 'build', 'close']);
  });
});

describe('ganttLayout', () => {
  it('positions bars as percentages of the whole run', () => {
    const bars = ganttLayout(timelineRows(tree));
    expect(bars[0]).toEqual(expect.objectContaining({ left: 0, width: (10 / 22) * 100 }));
    expect(bars[4].left + bars[4].width).toBeCloseTo(100);
  });
});

describe('overlappingKeys', () => {
  it('finds steps of the same run that overlapped (parallel branches)', () => {
    const parallel = run('p', 'par', [['fan', 'parallel'], ['a', 'agent_task'], ['b', 'agent_task']], [['fan', 0, 10], ['a', 1, 6], ['b', 2, 9]]);
    const keys = overlappingKeys(timelineRows(parallel));
    expect(keys.has('p-a') && keys.has('p-b')).toBe(true);
  });
});

describe('pathTo / childRunsOf', () => {
  it('builds the breadcrumb from the root run to a sub-workflow run', () => {
    expect(pathTo(tree, 'child').map(t => t.run.workflowDefId)).toEqual(['main', 'build']);
    expect(pathTo(tree, 'nope')).toEqual([]);
    expect(childRunsOf(tree, 'build')).toHaveLength(1);
  });
});

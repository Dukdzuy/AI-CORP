import { WorkflowDefinition } from '@ai-corp/shared-types';

/** GET /api/workflows/runs/:id */
export interface WorkflowRunTree {
  run: {
    id: string;
    projectId: string;
    workflowDefId: string;
    workflowDefVersion?: string | null;
    parentRunId?: string | null;
    parentNodeId?: string | null;
    status: string;
    currentNodeId: string | null;
    startedAt: string;
    completedAt: string | null;
  };
  definition: Pick<WorkflowDefinition, 'id' | 'name' | 'version' | 'startNode' | 'endNode' | 'nodes' | 'edges'> | null;
  steps: Array<{
    id: string;
    workflowRunId: string;
    nodeId: string;
    agentRole?: string | null;
    status: string;
    startedAt: string | null;
    completedAt?: string | null;
    durationMs?: number | null;
    error?: string | null;
    output?: unknown;
  }>;
  children: WorkflowRunTree[];
}

/** One bar of the execution timeline */
export interface TimelineRow {
  key: string;
  label: string;
  depth: number;
  kind: 'step' | 'sub_workflow';
  status: string;
  agentRole?: string | null;
  start: number;
  end: number;
  /** For sub_workflow rows: the child run */
  runId?: string;
}

/** The sub-workflow runs a sub_workflow node started, oldest first (a retried node can start several) */
export function childRunsOf(tree: WorkflowRunTree, nodeId: string): WorkflowRunTree[] {
  return tree.children.filter(child => child.run.parentNodeId === nodeId);
}

const time = (value?: string | null) => (value ? new Date(value).getTime() : NaN);

/**
 * Flatten a run tree into timeline rows: every step in start order, and under each sub_workflow
 * step the rows of the child run it started (indented one level), unless that node is collapsed.
 */
export function timelineRows(tree: WorkflowRunTree, collapsed: Set<string> = new Set(), now = Date.now(), depth = 0): TimelineRow[] {
  const rows: TimelineRow[] = [];
  const steps = [...tree.steps].sort((a, b) => time(a.startedAt) - time(b.startedAt));
  const typeOf = (nodeId: string) => tree.definition?.nodes.find(n => n.id === nodeId)?.type;

  for (const step of steps) {
    const start = time(step.startedAt);
    if (Number.isNaN(start)) continue;
    const completed = time(step.completedAt);
    const end = Number.isNaN(completed)
      ? (step.durationMs != null ? start + step.durationMs : step.status === 'running' ? now : start)
      : completed;
    const isSub = typeOf(step.nodeId) === 'sub_workflow';
    const child = isSub
      ? childRunsOf(tree, step.nodeId).find(c => time(c.run.startedAt) >= start - 1000) // the child this attempt started
      : undefined;

    rows.push({
      key: step.id,
      label: step.nodeId,
      depth,
      kind: isSub ? 'sub_workflow' : 'step',
      status: step.status,
      agentRole: step.agentRole,
      start,
      end: Math.max(end, start),
      runId: child?.run.id,
    });

    if (child && !collapsed.has(step.id)) {
      rows.push(...timelineRows(child, collapsed, now, depth + 1));
    }
  }
  return rows;
}

/** Bar positions as percentages of the whole timeline */
export function ganttLayout(rows: TimelineRow[]): Array<TimelineRow & { left: number; width: number }> {
  if (rows.length === 0) return [];
  const min = Math.min(...rows.map(r => r.start));
  const max = Math.max(...rows.map(r => r.end));
  const span = Math.max(max - min, 1);
  return rows.map(row => ({
    ...row,
    left: ((row.start - min) / span) * 100,
    width: Math.max(((row.end - row.start) / span) * 100, 0.5),
  }));
}

/** Runs from the root to the run with this id (breadcrumb); empty when it isn't in the tree */
export function pathTo(tree: WorkflowRunTree, runId: string): WorkflowRunTree[] {
  if (tree.run.id === runId) return [tree];
  for (const child of tree.children) {
    const path = pathTo(child, runId);
    if (path.length > 0) return [tree, ...path];
  }
  return [];
}

/** Rows that ran at the same time as another row of the same run (parallel branches) */
export function overlappingKeys(rows: TimelineRow[]): Set<string> {
  const result = new Set<string>();
  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.depth === b.depth && a.kind === 'step' && b.kind === 'step' && a.start < b.end && b.start < a.end) {
        result.add(a.key);
        result.add(b.key);
      }
    }
  }
  return result;
}

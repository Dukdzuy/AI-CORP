/**
 * Progress shown on a project card, from the project's latest run: GET /projects returns it as
 * `latestRun` with the current node's position in the run's own workflow definition, so any
 * template (not one hard-coded node list) gets a real percentage. Without a run the project's
 * workflow never started. `tone` colours the bar: red only for a failed run, not for "under 50%".
 */
export interface RunSummary {
  status: string;
  currentNodeId?: string | null;
  nodeIndex?: number;
  nodeCount?: number;
}

export interface ProgressInput {
  status: string;
  latestRun?: RunSummary | null;
  /** Project detail responses carry the runs, newest first */
  workflowRuns?: RunSummary[];
}

export type ProgressTone = 'success' | 'active' | 'warning' | 'error' | 'muted';

export interface ProjectProgress {
  percent: number;
  label: string;
  tone: ProgressTone;
}

function nodePercent(run: RunSummary): number {
  if (run.nodeIndex === undefined || run.nodeCount === undefined || run.nodeIndex < 0 || run.nodeCount <= 0) return 0;
  return Math.round((run.nodeIndex / run.nodeCount) * 100);
}

export function projectProgress(project: ProgressInput): ProjectProgress {
  const run = project.latestRun ?? project.workflowRuns?.[0] ?? null;
  if (project.status === 'cancelled') return { percent: run ? nodePercent(run) : 0, label: 'Cancelled', tone: 'muted' };
  if (!run) {
    if (project.status === 'completed') return { percent: 100, label: 'Completed', tone: 'success' };
    return { percent: 0, label: 'Workflow not started', tone: 'warning' };
  }

  const percent = nodePercent(run);
  const at = run.currentNodeId ? ` at ${run.currentNodeId}` : '';
  switch (run.status) {
    case 'completed':
      return { percent: 100, label: 'Completed', tone: 'success' };
    case 'failed':
      return { percent, label: `Failed${at}`, tone: 'error' };
    case 'cancelled':
      return { percent, label: 'Workflow cancelled', tone: 'muted' };
    case 'paused':
      return { percent, label: `Paused${at}`, tone: 'warning' };
    default:
      return { percent, label: `Running${at}`, tone: 'active' };
  }
}

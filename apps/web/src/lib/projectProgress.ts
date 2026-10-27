/**
 * Progress shown on a project card. GET /projects returns projects without their runs, so the
 * card used to show "Starting... 0%" for every project, finished ones included (found while
 * preparing the demo, Phase 7). The latest run is used when present, the project status otherwise.
 */
export interface ProgressInput {
  status: string;
  budget?: number | null;
  costAccrued?: number | null;
  workflowRuns?: { status: string; currentNodeId?: string | null }[];
}

export interface ProjectProgress {
  percent: number;
  label: string;
}

const NODE_ORDER = ['start', 'analysis_design', 'breakdown', 'build', 'develop', 'review', 'market', 'approval', 'end'];

export function projectProgress(project: ProgressInput): ProjectProgress {
  const run = project.workflowRuns?.[0];
  const status = run?.status ?? project.status;
  if (status === 'completed') return { percent: 100, label: 'Completed' };
  if (status === 'failed') return { percent: 50, label: 'Failed' };
  if (status === 'cancelled') return { percent: 0, label: 'Cancelled' };
  if (status === 'paused') return { percent: 75, label: 'Paused' };
  if (run) {
    const index = NODE_ORDER.indexOf(run.currentNodeId || 'start');
    return {
      percent: index >= 0 ? Math.round((index / NODE_ORDER.length) * 100) : 25,
      label: `Running: ${run.currentNodeId || 'start'}`,
    };
  }
  if (project.budget != null && project.budget > 0) {
    const percent = Math.min(100, Math.round((Number(project.costAccrued ?? 0) / Number(project.budget)) * 100));
    return { percent, label: `Running, ${percent}% of budget` };
  }
  return { percent: 0, label: 'Running' };
}

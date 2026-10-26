/**
 * Agent performance report (Phase 5, Task 23)
 *
 * Built from workflow steps: how often each role ran, how often it succeeded on the
 * first try, and how long it took. Steps without an agent (gates, conditions, approvals)
 * are reported under their node type so the whole run is accounted for.
 *
 * @pattern Builder
 */
export interface StepRecord {
  agentRole: string | null;
  nodeId: string;
  status: string; // completed, failed, skipped, running, pending
  durationMs: number | null;
  retryCount: number;
}

export interface RolePerformance {
  role: string;
  executions: number;
  completed: number;
  failed: number;
  successRate: number | null; // completed / (completed + failed), 0..1; null when nothing finished
  avgDurationMs: number;
  p95DurationMs: number;
  retries: number;
}

export interface PerformanceReport {
  projectId: string | null;
  generatedAt: string;
  totalSteps: number;
  overallSuccessRate: number | null;
  byRole: RolePerformance[];
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[Math.max(0, idx)];
}

export class PerformanceReportBuilder {
  static build(projectId: string | null, steps: readonly StepRecord[], now = new Date()): PerformanceReport {
    const groups = new Map<string, StepRecord[]>();
    for (const s of steps) {
      const key = s.agentRole ?? `(${s.nodeId})`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }

    const byRole: RolePerformance[] = [...groups.entries()].map(([role, list]) => {
      const completed = list.filter(s => s.status === 'completed').length;
      const failed = list.filter(s => s.status === 'failed').length;
      const durations = list.map(s => s.durationMs).filter((d): d is number => typeof d === 'number').sort((a, b) => a - b);
      return {
        role,
        executions: list.length,
        completed,
        failed,
        successRate: completed + failed > 0 ? Math.round((completed / (completed + failed)) * 10_000) / 10_000 : null,
        avgDurationMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
        p95DurationMs: percentile(durations, 95),
        retries: list.reduce((s, x) => s + (x.retryCount || 0), 0),
      };
    });
    byRole.sort((a, b) => b.executions - a.executions || a.role.localeCompare(b.role));

    const completed = steps.filter(s => s.status === 'completed').length;
    const finished = completed + steps.filter(s => s.status === 'failed').length;
    return {
      projectId,
      generatedAt: now.toISOString(),
      totalSteps: steps.length,
      overallSuccessRate: finished ? Math.round((completed / finished) * 10_000) / 10_000 : null,
      byRole,
    };
  }
}

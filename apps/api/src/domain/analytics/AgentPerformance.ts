/**
 * Agent performance analytics (Phase 6, Task 24)
 *
 * Turns the workflow history (steps, LLM usage, OOAD gate results) into per-role metrics
 * for a period and compares them with the previous period of the same length.
 *
 * Each metric is computed from data the platform really records:
 * - success rate: completed / (completed + failed) steps
 * - duration: step `durationMs` (average and p95)
 * - cost: LLM usage cost of the role (`ApiUsageLog`), per execution and per successful step
 * - quality: a role-specific signal (see `QUALITY_SIGNALS`), e.g. how often QA approved
 *   the DEV's code, how often the OOAD gate passed the Architect's design
 * - trend: the change of each metric against the previous period (replaces the plan's
 *   per-day "learning velocity", which is not meaningful with a few runs per week)
 *
 * @pattern Builder (the analyzer), Strategy (quality signals)
 */
import { mean, percentile, ratio, round } from './stats';

export interface AnalyticsStep {
  agentRole: string;
  nodeId: string;
  status: string; // completed, failed, skipped, running, pending
  durationMs: number | null;
  retryCount: number;
  startedAt: Date;
  /** Verdicts the agent produced, extracted from the step output (QA, QC) */
  verdict?: { qaApproved?: boolean; qcPassed?: boolean };
  /** Static-analysis prediction attached to a DEV step (Task 26) */
  predictedQaVerdict?: 'pass' | 'fail';
  workflowRunId?: string;
}

export interface AnalyticsUsage {
  agentRole: string;
  cost: number;
  createdAt: Date;
}

export interface AnalyticsGate {
  passed: boolean;
  timestamp: Date;
}

export interface AnalyticsInput {
  steps: readonly AnalyticsStep[];
  usage: readonly AnalyticsUsage[];
  gates: readonly AnalyticsGate[];
}

export interface Period {
  start: Date;
  end: Date;
}

export interface QualityScore {
  value: number | null; // 0..1, null when there is nothing to judge
  basis: string; // what the number means, shown in the UI
  samples: number;
}

export interface AgentPerformanceMetrics {
  agentRole: string;
  executionCount: number;
  completed: number;
  failed: number;
  successRate: number | null;
  avgDurationMs: number;
  p95DurationMs: number;
  retries: number;
  totalCost: number;
  costPerExecution: number | null;
  costPerSuccess: number | null;
  quality: QualityScore;
}

export interface MetricTrend {
  successRateDelta: number | null; // percentage points / 100 (0.1 = +10 points)
  avgDurationChange: number | null; // relative change (0.5 = 50 % slower)
  costPerExecutionChange: number | null;
  qualityDelta: number | null;
}

export interface AgentPerformanceRow extends AgentPerformanceMetrics {
  previous: AgentPerformanceMetrics;
  trend: MetricTrend;
  rank: number;
  /** Finished statuses of the role in time order (last 10), for streak detection */
  recentOutcomes: Array<'completed' | 'failed'>;
}

export interface DailyPoint {
  date: string; // YYYY-MM-DD (UTC)
  role: string;
  executions: number;
  successRate: number | null;
}

export interface HeatmapCell {
  weekday: number; // 0 = Sunday (UTC)
  hour: number; // 0..23 (UTC)
  count: number;
}

export interface QaPredictionAccuracy {
  /** DEV steps with a static-analysis prediction followed by a QA verdict in the same run */
  samples: number;
  truePass: number;
  trueFail: number;
  falsePass: number; // predicted pass, QA rejected
  falseFail: number; // predicted fail, QA approved
  accuracy: number | null;
}

export interface AgentAnalytics {
  period: { start: string; end: string; previousStart: string };
  generatedAt: string;
  roles: AgentPerformanceRow[];
  daily: DailyPoint[];
  heatmap: HeatmapCell[];
  qaPrediction: QaPredictionAccuracy;
}

/** A role-specific quality signal */
export interface IQualitySignal {
  readonly basis: string;
  score(role: string, steps: readonly AnalyticsStep[], input: AnalyticsInput, period: Period): QualityScore;
}

const inPeriod = (d: Date, p: Period) => d.getTime() >= p.start.getTime() && d.getTime() < p.end.getTime();

/** DEV: share of QA reviews that approved the code */
export class QaApprovalSignal implements IQualitySignal {
  readonly basis = 'QA reviews approved';
  score(_role: string, _steps: readonly AnalyticsStep[], input: AnalyticsInput, period: Period): QualityScore {
    const reviews = input.steps.filter(s => s.agentRole === 'QA' && typeof s.verdict?.qaApproved === 'boolean' && inPeriod(s.startedAt, period));
    return { value: ratio(reviews.filter(s => s.verdict!.qaApproved).length, reviews.length), basis: this.basis, samples: reviews.length };
  }
}

/** QC: share of verifications where the acceptance tests passed */
export class QcPassSignal implements IQualitySignal {
  readonly basis = 'QC verifications passed';
  score(_role: string, steps: readonly AnalyticsStep[]): QualityScore {
    const runs = steps.filter(s => typeof s.verdict?.qcPassed === 'boolean');
    return { value: ratio(runs.filter(s => s.verdict!.qcPassed).length, runs.length), basis: this.basis, samples: runs.length };
  }
}

/** Architect: share of OOAD gate evaluations that passed the design */
export class OoadGateSignal implements IQualitySignal {
  readonly basis = 'OOAD gate passed';
  score(_role: string, _steps: readonly AnalyticsStep[], input: AnalyticsInput, period: Period): QualityScore {
    const gates = input.gates.filter(g => inPeriod(g.timestamp, period));
    return { value: ratio(gates.filter(g => g.passed).length, gates.length), basis: this.basis, samples: gates.length };
  }
}

/** Every other role: steps that succeeded on the first attempt */
export class FirstAttemptSignal implements IQualitySignal {
  readonly basis = 'succeeded without retry';
  score(_role: string, steps: readonly AnalyticsStep[]): QualityScore {
    const finished = steps.filter(s => s.status === 'completed' || s.status === 'failed');
    return { value: ratio(finished.filter(s => s.status === 'completed' && !s.retryCount).length, finished.length), basis: this.basis, samples: finished.length };
  }
}

export const QUALITY_SIGNALS: Readonly<Record<string, IQualitySignal>> = {
  DEV: new QaApprovalSignal(),
  QC: new QcPassSignal(),
  ARCHITECT: new OoadGateSignal(),
};
const DEFAULT_SIGNAL = new FirstAttemptSignal();

export class AgentPerformanceAnalyzer {
  constructor(private readonly signals: Readonly<Record<string, IQualitySignal>> = QUALITY_SIGNALS) {}

  /** Metrics of every role in `period`, compared with the period of the same length before it */
  analyze(input: AnalyticsInput, period: Period, now = new Date()): AgentAnalytics {
    const length = period.end.getTime() - period.start.getTime();
    const previous: Period = { start: new Date(period.start.getTime() - length), end: period.start };

    const roles = [...new Set(input.steps.filter(s => inPeriod(s.startedAt, period)).map(s => s.agentRole))];
    const rows = roles.map(role => {
      const current = this.metrics(role, input, period);
      const before = this.metrics(role, input, previous);
      const outcomes = input.steps
        .filter(s => s.agentRole === role && inPeriod(s.startedAt, period) && (s.status === 'completed' || s.status === 'failed'))
        .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime())
        .slice(-10)
        .map(s => s.status as 'completed' | 'failed');
      return { ...current, previous: before, trend: AgentPerformanceAnalyzer.trend(current, before), rank: 0, recentOutcomes: outcomes };
    });

    // Leaderboard: success rate, then quality, then the cheaper successful step
    rows.sort((a, b) =>
      (b.successRate ?? -1) - (a.successRate ?? -1) ||
      (b.quality.value ?? -1) - (a.quality.value ?? -1) ||
      (a.costPerSuccess ?? Infinity) - (b.costPerSuccess ?? Infinity) ||
      a.agentRole.localeCompare(b.agentRole)
    );
    rows.forEach((r, i) => (r.rank = i + 1));

    const current = input.steps.filter(s => inPeriod(s.startedAt, period));
    return {
      period: { start: period.start.toISOString(), end: period.end.toISOString(), previousStart: previous.start.toISOString() },
      generatedAt: now.toISOString(),
      roles: rows,
      daily: AgentPerformanceAnalyzer.daily(current),
      heatmap: AgentPerformanceAnalyzer.heatmap(current),
      qaPrediction: AgentPerformanceAnalyzer.qaPrediction(current),
    };
  }

  metrics(role: string, input: AnalyticsInput, period: Period): AgentPerformanceMetrics {
    const steps = input.steps.filter(s => s.agentRole === role && inPeriod(s.startedAt, period));
    const completed = steps.filter(s => s.status === 'completed').length;
    const failed = steps.filter(s => s.status === 'failed').length;
    const durations = steps.map(s => s.durationMs).filter((d): d is number => typeof d === 'number').sort((a, b) => a - b);
    const totalCost = round(input.usage.filter(u => u.agentRole === role && inPeriod(u.createdAt, period)).reduce((s, u) => s + u.cost, 0), 6);
    const signal = this.signals[role] ?? DEFAULT_SIGNAL;
    return {
      agentRole: role,
      executionCount: steps.length,
      completed,
      failed,
      successRate: ratio(completed, completed + failed),
      avgDurationMs: Math.round(mean(durations)),
      p95DurationMs: percentile(durations, 95),
      retries: steps.reduce((s, x) => s + (x.retryCount || 0), 0),
      totalCost,
      costPerExecution: steps.length ? round(totalCost / steps.length, 6) : null,
      costPerSuccess: completed ? round(totalCost / completed, 6) : null,
      quality: signal.score(role, steps, input, period),
    };
  }

  static trend(current: AgentPerformanceMetrics, previous: AgentPerformanceMetrics): MetricTrend {
    const change = (a: number | null, b: number | null) => (a !== null && b !== null && b > 0 ? round((a - b) / b) : null);
    const delta = (a: number | null, b: number | null) => (a !== null && b !== null ? round(a - b) : null);
    return {
      successRateDelta: delta(current.successRate, previous.successRate),
      avgDurationChange: current.executionCount && previous.executionCount ? change(current.avgDurationMs, previous.avgDurationMs) : null,
      costPerExecutionChange: change(current.costPerExecution, previous.costPerExecution),
      qualityDelta: delta(current.quality.value, previous.quality.value),
    };
  }

  static daily(steps: readonly AnalyticsStep[]): DailyPoint[] {
    const groups = new Map<string, AnalyticsStep[]>();
    for (const s of steps) {
      const key = `${s.startedAt.toISOString().slice(0, 10)}|${s.agentRole}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(s);
    }
    return [...groups.entries()]
      .map(([key, list]) => {
        const [date, role] = key.split('|');
        const completed = list.filter(s => s.status === 'completed').length;
        const failed = list.filter(s => s.status === 'failed').length;
        return { date, role, executions: list.length, successRate: ratio(completed, completed + failed) };
      })
      .sort((a, b) => a.date.localeCompare(b.date) || a.role.localeCompare(b.role));
  }

  static heatmap(steps: readonly AnalyticsStep[]): HeatmapCell[] {
    const counts = new Map<string, number>();
    for (const s of steps) {
      const key = `${s.startedAt.getUTCDay()}|${s.startedAt.getUTCHours()}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => {
        const [weekday, hour] = key.split('|').map(Number);
        return { weekday, hour, count };
      })
      .sort((a, b) => a.weekday - b.weekday || a.hour - b.hour);
  }

  /**
   * How well the static-analysis prediction attached to a DEV step (Task 26) matched the
   * next QA verdict in the same run.
   */
  static qaPrediction(steps: readonly AnalyticsStep[]): QaPredictionAccuracy {
    const byRun = new Map<string, AnalyticsStep[]>();
    for (const s of steps) {
      if (!s.workflowRunId) continue;
      if (!byRun.has(s.workflowRunId)) byRun.set(s.workflowRunId, []);
      byRun.get(s.workflowRunId)!.push(s);
    }
    const result = { samples: 0, truePass: 0, trueFail: 0, falsePass: 0, falseFail: 0 };
    for (const list of byRun.values()) {
      const ordered = [...list].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
      ordered.forEach((dev, i) => {
        if (dev.agentRole !== 'DEV' || !dev.predictedQaVerdict) return;
        const review = ordered.slice(i + 1).find(s => s.agentRole === 'QA' && typeof s.verdict?.qaApproved === 'boolean');
        if (!review) return;
        const predictedPass = dev.predictedQaVerdict === 'pass';
        const actualPass = review.verdict!.qaApproved!;
        result.samples++;
        if (predictedPass && actualPass) result.truePass++;
        else if (!predictedPass && !actualPass) result.trueFail++;
        else if (predictedPass) result.falsePass++;
        else result.falseFail++;
      });
    }
    return { ...result, accuracy: ratio(result.truePass + result.trueFail, result.samples) };
  }
}

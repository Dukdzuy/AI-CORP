/**
 * Agent performance anomalies (Phase 6, Task 24)
 *
 * Rules compare a role's metrics in the current period with the previous one. A rule only
 * fires when both periods have enough finished steps (`minSamples`), so one failed run
 * on a quiet week does not raise an alert.
 *
 * @pattern Strategy (one rule per kind of anomaly), Composite (the detector)
 */
import { AgentPerformanceRow } from './AgentPerformance';

export type AgentAnomalySeverity = 'medium' | 'high';

export type AgentAnomalyType =
  | 'performance_degradation'
  | 'repeated_failures'
  | 'cost_spike'
  | 'slowdown'
  | 'low_quality';

export interface AgentAnomaly {
  type: AgentAnomalyType;
  agentRole: string;
  severity: AgentAnomalySeverity;
  message: string;
  value: number;
  threshold: number;
}

export interface IAgentAnomalyRule {
  readonly type: AgentAnomalyType;
  detect(row: AgentPerformanceRow): AgentAnomaly | null;
}

const finished = (m: { completed: number; failed: number }) => m.completed + m.failed;
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** Success rate fell by at least `drop` (0.2 = 20 points) against the previous period */
export class SuccessRateDropRule implements IAgentAnomalyRule {
  readonly type = 'performance_degradation' as const;
  constructor(private readonly drop = 0.2, private readonly minSamples = 3) {}
  detect(row: AgentPerformanceRow): AgentAnomaly | null {
    const delta = row.trend.successRateDelta;
    if (delta === null || delta > -this.drop) return null;
    if (finished(row) < this.minSamples || finished(row.previous) < this.minSamples) return null;
    return {
      type: this.type,
      agentRole: row.agentRole,
      severity: delta <= -2 * this.drop ? 'high' : 'medium',
      message: `${row.agentRole} success rate fell from ${pct(row.previous.successRate!)} to ${pct(row.successRate!)}`,
      value: delta,
      threshold: -this.drop,
    };
  }
}

/** The last `streak` finished steps of the role all failed */
export class RepeatedFailureRule implements IAgentAnomalyRule {
  readonly type = 'repeated_failures' as const;
  constructor(private readonly streak = 3) {}
  detect(row: AgentPerformanceRow): AgentAnomaly | null {
    const tail = row.recentOutcomes.slice(-this.streak);
    if (tail.length < this.streak || tail.some(o => o !== 'failed')) return null;
    let count = 0;
    for (let i = row.recentOutcomes.length - 1; i >= 0 && row.recentOutcomes[i] === 'failed'; i--) count++;
    return {
      type: this.type,
      agentRole: row.agentRole,
      severity: 'high',
      message: `${row.agentRole} failed its last ${count} steps in a row`,
      value: count,
      threshold: this.streak,
    };
  }
}

/** LLM cost per execution grew by at least `factor` */
export class CostSpikeRule implements IAgentAnomalyRule {
  readonly type = 'cost_spike' as const;
  constructor(private readonly factor = 2, private readonly minSamples = 3) {}
  detect(row: AgentPerformanceRow): AgentAnomaly | null {
    const change = row.trend.costPerExecutionChange;
    if (change === null || change < this.factor - 1) return null;
    if (row.executionCount < this.minSamples || row.previous.executionCount < this.minSamples) return null;
    return {
      type: this.type,
      agentRole: row.agentRole,
      severity: 'medium',
      message: `${row.agentRole} costs ${(change + 1).toFixed(1)}× more per step than in the previous period`,
      value: change + 1,
      threshold: this.factor,
    };
  }
}

/** Average step duration grew by at least `factor` */
export class SlowdownRule implements IAgentAnomalyRule {
  readonly type = 'slowdown' as const;
  constructor(private readonly factor = 2, private readonly minSamples = 3) {}
  detect(row: AgentPerformanceRow): AgentAnomaly | null {
    const change = row.trend.avgDurationChange;
    if (change === null || change < this.factor - 1) return null;
    if (row.executionCount < this.minSamples || row.previous.executionCount < this.minSamples) return null;
    return {
      type: this.type,
      agentRole: row.agentRole,
      severity: 'medium',
      message: `${row.agentRole} steps take ${(change + 1).toFixed(1)}× longer than in the previous period`,
      value: change + 1,
      threshold: this.factor,
    };
  }
}

/** The role's quality signal is below `minimum` over enough samples */
export class LowQualityRule implements IAgentAnomalyRule {
  readonly type = 'low_quality' as const;
  constructor(private readonly minimum = 0.5, private readonly minSamples = 3) {}
  detect(row: AgentPerformanceRow): AgentAnomaly | null {
    const { value, samples, basis } = row.quality;
    if (value === null || value >= this.minimum || samples < this.minSamples) return null;
    return {
      type: this.type,
      agentRole: row.agentRole,
      severity: 'medium',
      message: `${row.agentRole} quality is low: ${pct(value)} ${basis} (${samples} samples)`,
      value,
      threshold: this.minimum,
    };
  }
}

export const DEFAULT_AGENT_ANOMALY_RULES: readonly IAgentAnomalyRule[] = [
  new SuccessRateDropRule(),
  new RepeatedFailureRule(),
  new CostSpikeRule(),
  new SlowdownRule(),
  new LowQualityRule(),
];

export class AgentAnomalyDetector {
  constructor(private readonly rules: readonly IAgentAnomalyRule[] = DEFAULT_AGENT_ANOMALY_RULES) {}

  detect(rows: readonly AgentPerformanceRow[]): AgentAnomaly[] {
    const severity = { high: 0, medium: 1 };
    return rows
      .flatMap(row => this.rules.map(rule => rule.detect(row)))
      .filter((a): a is AgentAnomaly => a !== null)
      .sort((a, b) => severity[a.severity] - severity[b.severity] || a.agentRole.localeCompare(b.agentRole));
  }

  /** Key used to raise each anomaly only once per day */
  static key(anomaly: AgentAnomaly, at: Date): string {
    return `${anomaly.agentRole}|${anomaly.type}|${at.toISOString().slice(0, 10)}`;
  }
}

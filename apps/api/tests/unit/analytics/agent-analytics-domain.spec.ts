import {
  AgentAnomalyDetector,
  AgentPerformanceAnalyzer,
  AgentPerformanceRow,
  AnalyticsInput,
  AnalyticsStep,
  CostSpikeRule,
  LowQualityRule,
  RepeatedFailureRule,
  SlowdownRule,
  SuccessRateDropRule,
  median,
  percentile,
  ratio,
} from '../../../src/domain/analytics';

const day = (d: number, hour = 10) => new Date(Date.UTC(2026, 9, d, hour));
const step = (agentRole: string, status: string, at: Date, extra: Partial<AnalyticsStep> = {}): AnalyticsStep => ({
  agentRole, nodeId: agentRole.toLowerCase(), status, durationMs: 1000, retryCount: 0, startedAt: at, ...extra,
});
const period = { start: day(15, 0), end: day(29, 0) }; // previous period: Oct 1–15
const input = (steps: AnalyticsStep[], extra: Partial<AnalyticsInput> = {}): AnalyticsInput => ({ steps, usage: [], gates: [], ...extra });

describe('Phase 6 / Task 24: agent performance analytics (domain)', () => {
  const analyzer = new AgentPerformanceAnalyzer();

  it('stats helpers', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBe(0);
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95)).toBe(10);
    expect(percentile([], 95)).toBe(0);
    expect(ratio(1, 3)).toBe(0.3333);
    expect(ratio(1, 0)).toBeNull();
  });

  it('per-role metrics: success over finished steps, durations, cost per execution and per success', () => {
    const steps = [
      step('DEV', 'completed', day(20), { durationMs: 1000, retryCount: 1 }),
      step('DEV', 'completed', day(21), { durationMs: 3000 }),
      step('DEV', 'failed', day(22), { durationMs: 2000 }),
      step('DEV', 'running', day(23), { durationMs: null }),
      step('DEV', 'completed', day(2)), // previous period
    ];
    const usage = [
      { agentRole: 'DEV', cost: 0.3, createdAt: day(20) },
      { agentRole: 'DEV', cost: 0.1, createdAt: day(21) },
      { agentRole: 'DEV', cost: 5, createdAt: day(2) },
    ];
    const m = analyzer.metrics('DEV', input(steps, { usage }), period);
    expect(m).toMatchObject({
      executionCount: 4, completed: 2, failed: 1, successRate: 0.6667,
      avgDurationMs: 2000, p95DurationMs: 3000, retries: 1,
      totalCost: 0.4, costPerExecution: 0.1, costPerSuccess: 0.2,
    });
  });

  it('quality signals: QA approvals for DEV, QC passes, OOAD gate for the Architect, first-attempt success otherwise', () => {
    const steps = [
      step('DEV', 'completed', day(20)),
      step('QA', 'completed', day(20), { verdict: { qaApproved: false } }),
      step('QA', 'completed', day(21), { verdict: { qaApproved: true } }),
      step('QA', 'completed', day(22), { verdict: { qaApproved: true } }),
      step('QC', 'completed', day(20), { verdict: { qcPassed: true } }),
      step('QC', 'completed', day(21), { verdict: { qcPassed: false } }),
      step('ARCHITECT', 'completed', day(20)),
      step('BA', 'completed', day(20), { retryCount: 1 }),
      step('BA', 'completed', day(21)),
    ];
    const gates = [{ passed: false, timestamp: day(20) }, { passed: true, timestamp: day(21) }, { passed: true, timestamp: day(3) }];
    const rows = analyzer.analyze(input(steps, { gates }), period, day(29)).roles;
    const q = (role: string) => rows.find(r => r.agentRole === role)!.quality;
    expect(q('DEV')).toEqual({ value: 0.6667, basis: 'QA reviews approved', samples: 3 });
    expect(q('QC')).toEqual({ value: 0.5, basis: 'QC verifications passed', samples: 2 });
    expect(q('ARCHITECT')).toEqual({ value: 0.5, basis: 'OOAD gate passed', samples: 2 });
    expect(q('BA')).toEqual({ value: 0.5, basis: 'succeeded without retry', samples: 2 });
  });

  it('trend against the previous period, leaderboard order and recent outcomes', () => {
    const steps = [
      ...[1, 2, 3, 4].map(d => step('DEV', 'completed', day(d), { durationMs: 1000 })),
      step('DEV', 'completed', day(20), { durationMs: 3000 }),
      step('DEV', 'failed', day(21), { durationMs: 3000 }),
      step('PM', 'completed', day(20)),
    ];
    const usage = [
      { agentRole: 'DEV', cost: 0.4, createdAt: day(2) },
      { agentRole: 'DEV', cost: 0.4, createdAt: day(20) },
    ];
    const result = analyzer.analyze(input(steps, { usage }), period, day(29));
    expect(result.period).toEqual({ start: period.start.toISOString(), end: period.end.toISOString(), previousStart: day(1, 0).toISOString() });
    expect(result.roles.map(r => [r.agentRole, r.rank])).toEqual([['PM', 1], ['DEV', 2]]);
    const dev = result.roles.find(r => r.agentRole === 'DEV')!;
    expect(dev.previous).toMatchObject({ executionCount: 4, successRate: 1, avgDurationMs: 1000 });
    expect(dev.trend).toEqual({ successRateDelta: -0.5, avgDurationChange: 2, costPerExecutionChange: 1, qualityDelta: null });
    expect(dev.recentOutcomes).toEqual(['completed', 'failed']);
  });

  it('daily series and the weekday × hour heatmap (UTC)', () => {
    const steps = [step('DEV', 'completed', day(20, 9)), step('DEV', 'failed', day(20, 9)), step('QA', 'completed', day(21, 14))];
    const result = analyzer.analyze(input(steps), period, day(29));
    expect(result.daily).toEqual([
      { date: '2026-10-20', role: 'DEV', executions: 2, successRate: 0.5 },
      { date: '2026-10-21', role: 'QA', executions: 1, successRate: 1 },
    ]);
    expect(result.heatmap).toEqual([{ weekday: 2, hour: 9, count: 2 }, { weekday: 3, hour: 14, count: 1 }]);
  });

  it('QA prediction accuracy: a DEV prediction is matched with the next QA verdict of the same run', () => {
    const steps = [
      step('DEV', 'completed', day(20, 1), { workflowRunId: 'r1', predictedQaVerdict: 'fail' }),
      step('QA', 'completed', day(20, 2), { workflowRunId: 'r1', verdict: { qaApproved: false } }),
      step('DEV', 'completed', day(20, 3), { workflowRunId: 'r1', predictedQaVerdict: 'pass' }),
      step('QA', 'completed', day(20, 4), { workflowRunId: 'r1', verdict: { qaApproved: true } }),
      step('DEV', 'completed', day(21, 1), { workflowRunId: 'r2', predictedQaVerdict: 'pass' }),
      step('QA', 'completed', day(21, 2), { workflowRunId: 'r2', verdict: { qaApproved: false } }),
      step('DEV', 'completed', day(22, 1), { workflowRunId: 'r3', predictedQaVerdict: 'fail' }),
      step('QA', 'completed', day(22, 2), { workflowRunId: 'r3', verdict: { qaApproved: true } }),
      step('DEV', 'completed', day(23, 1), { workflowRunId: 'r4', predictedQaVerdict: 'pass' }), // no review yet
      step('DEV', 'completed', day(23, 1)), // no run id
    ];
    expect(analyzer.analyze(input(steps), period, day(29)).qaPrediction).toEqual({
      samples: 4, truePass: 1, trueFail: 1, falsePass: 1, falseFail: 1, accuracy: 0.5,
    });
  });
});

describe('Phase 6 / Task 24: agent anomaly rules', () => {
  const row = (overrides: Partial<AgentPerformanceRow> = {}): AgentPerformanceRow => {
    const base = {
      agentRole: 'DEV', executionCount: 5, completed: 5, failed: 0, successRate: 1, avgDurationMs: 1000, p95DurationMs: 1000,
      retries: 0, totalCost: 1, costPerExecution: 0.2, costPerSuccess: 0.2, quality: { value: null, basis: 'x', samples: 0 },
    };
    return {
      ...base,
      previous: { ...base },
      trend: { successRateDelta: 0, avgDurationChange: 0, costPerExecutionChange: 0, qualityDelta: null },
      rank: 1,
      recentOutcomes: ['completed'],
      ...overrides,
    };
  };

  it('success-rate drop needs enough samples in both periods; severity grows with the drop', () => {
    const rule = new SuccessRateDropRule(0.2, 3);
    const dropped = row({ completed: 2, failed: 3, successRate: 0.4, trend: { successRateDelta: -0.6, avgDurationChange: 0, costPerExecutionChange: 0, qualityDelta: null } });
    expect(rule.detect(dropped)).toMatchObject({ type: 'performance_degradation', severity: 'high', value: -0.6, message: 'DEV success rate fell from 100% to 40%' });
    expect(rule.detect({ ...dropped, trend: { ...dropped.trend, successRateDelta: -0.25 } })!.severity).toBe('medium');
    expect(rule.detect({ ...dropped, trend: { ...dropped.trend, successRateDelta: -0.1 } })).toBeNull();
    expect(rule.detect({ ...dropped, completed: 1, failed: 1 })).toBeNull();
  });

  it('repeated failures count the whole trailing streak', () => {
    const rule = new RepeatedFailureRule(3);
    expect(rule.detect(row({ recentOutcomes: ['completed', 'failed', 'failed', 'failed', 'failed'] }))).toMatchObject({ severity: 'high', value: 4 });
    expect(rule.detect(row({ recentOutcomes: ['failed', 'failed', 'completed'] }))).toBeNull();
    expect(rule.detect(row({ recentOutcomes: ['failed', 'failed'] }))).toBeNull();
  });

  it('cost spike, slowdown and low quality', () => {
    const trend = { successRateDelta: 0, avgDurationChange: 1.5, costPerExecutionChange: 2, qualityDelta: null };
    expect(new CostSpikeRule().detect(row({ trend }))).toMatchObject({ type: 'cost_spike', value: 3, threshold: 2 });
    expect(new SlowdownRule().detect(row({ trend }))).toMatchObject({ type: 'slowdown', value: 2.5 });
    expect(new CostSpikeRule().detect(row({ trend, executionCount: 1 }))).toBeNull();
    expect(new SlowdownRule().detect(row())).toBeNull();
    expect(new LowQualityRule().detect(row({ quality: { value: 0.25, basis: 'QA reviews approved', samples: 4 } }))).toMatchObject({
      type: 'low_quality', message: 'DEV quality is low: 25% QA reviews approved (4 samples)',
    });
    expect(new LowQualityRule().detect(row({ quality: { value: 0.25, basis: 'x', samples: 2 } }))).toBeNull();
  });

  it('the detector runs every rule, high severity first, and keys anomalies per role, type and day', () => {
    const detector = new AgentAnomalyDetector();
    const anomalies = detector.detect([
      row({ agentRole: 'QA', trend: { successRateDelta: 0, avgDurationChange: 3, costPerExecutionChange: 0, qualityDelta: null } }),
      row({ agentRole: 'DEV', recentOutcomes: ['failed', 'failed', 'failed'] }),
      row({ agentRole: 'PM' }),
    ]);
    expect(anomalies.map(a => [a.agentRole, a.type, a.severity])).toEqual([['DEV', 'repeated_failures', 'high'], ['QA', 'slowdown', 'medium']]);
    expect(AgentAnomalyDetector.key(anomalies[0], day(20, 23))).toBe('DEV|repeated_failures|2026-10-20');
  });
});

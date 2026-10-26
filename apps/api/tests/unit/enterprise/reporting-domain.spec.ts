import { CostReportBuilder, PerformanceReportBuilder, csvCell, exportBaseName, isoWeekKey, toCsv } from '../../../src/domain/reporting';

const usage = (agentRole: string, model: string, cost: number, day: string, extra = {}) => ({
  agentRole, model, cost, totalTokens: 100, responseTimeMs: 200, fallback: false, createdAt: new Date(`${day}T10:00:00Z`), ...extra,
});

describe('Phase 5 / Task 23: reporting domain', () => {
  it('CostReport: totals, shares, buckets sorted by cost, days in order, budget use', () => {
    const report = CostReportBuilder.build('p1', [
      usage('DEV', 'gpt', 0.3, '2026-10-26'),
      usage('BA', 'gpt', 0.1, '2026-10-25'),
      usage('DEV', 'claude', 0.1, '2026-10-26', { fallback: true, responseTimeMs: 400 }),
    ], 2, new Date('2026-10-26T12:00:00Z'));

    expect(report).toMatchObject({ total: 0.5, calls: 3, totalTokens: 300, fallbackCalls: 1, avgResponseTimeMs: 267, budgetUsed: 0.25 });
    expect(report.byAgent).toEqual([
      { key: 'DEV', cost: 0.4, tokens: 200, calls: 2, share: 0.8 },
      { key: 'BA', cost: 0.1, tokens: 100, calls: 1, share: 0.2 },
    ]);
    expect(report.byModel.map(b => b.key)).toEqual(['gpt', 'claude']);
    expect(report.byDay).toEqual([{ date: '2026-10-25', cost: 0.1, calls: 1 }, { date: '2026-10-26', cost: 0.4, calls: 2 }]);
  });

  it('CostReport: empty usage and no budget', () => {
    const report = CostReportBuilder.build(null, [], null);
    expect(report).toMatchObject({ total: 0, calls: 0, avgResponseTimeMs: 0, budgetUsed: null, byAgent: [] });
  });

  it('PerformanceReport: success over finished steps, p95, retries, gate/approval nodes by node id', () => {
    const steps = [
      ...[100, 200, 300, 400].map(d => ({ agentRole: 'DEV', nodeId: 'develop', status: 'completed', durationMs: d, retryCount: 0 })),
      { agentRole: 'DEV', nodeId: 'develop', status: 'failed', durationMs: 50, retryCount: 2 },
      { agentRole: null, nodeId: 'approval', status: 'pending', durationMs: null, retryCount: 0 },
    ];
    const report = PerformanceReportBuilder.build('p1', steps);
    expect(report.byRole[0]).toEqual({ role: 'DEV', executions: 5, completed: 4, failed: 1, successRate: 0.8, avgDurationMs: 210, p95DurationMs: 400, retries: 2 });
    expect(report.byRole[1]).toMatchObject({ role: '(approval)', successRate: null, avgDurationMs: 0 });
    expect(report.overallSuccessRate).toBe(0.8);
    expect(PerformanceReportBuilder.build(null, []).overallSuccessRate).toBeNull();
  });

  it.each([
    ['2026-10-26', '2026-W44'], // Monday
    ['2026-11-01', '2026-W44'], // Sunday of the same week
    ['2027-01-01', '2026-W53'], // Friday: still the last ISO week of 2026
    ['2024-12-30', '2025-W01'], // Monday: first ISO week of 2025
  ])('isoWeekKey(%s) = %s', (date, key) => {
    expect(isoWeekKey(new Date(`${date}T12:00:00Z`))).toBe(key);
  });

  it('CSV: quoting, line breaks, objects and formula injection', () => {
    expect(csvCell('plain')).toBe('plain');
    expect(csvCell('a,b')).toBe('"a,b"');
    expect(csvCell('say "hi"\nbye')).toBe('"say ""hi""\nbye"');
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(`"'=HYPERLINK(""http://evil"")"`);
    expect(csvCell('-1+2')).toBe("'-1+2");
    expect(csvCell(null)).toBe('');
    expect(csvCell({ a: 1 })).toBe('"{""a"":1}"');
    expect(toCsv(['h1', 'h2'], [[1, 'Thư viện']])).toBe('h1,h2\r\n1,Thư viện\r\n');
  });

  it('export file names are ASCII slugs of the project name', () => {
    const name = (n: string) => exportBaseName({ project: { name: n }, exportedAt: '2026-10-26T07:00:00Z' } as any);
    expect(name('Thư viện số (API)')).toBe('thu-vien-so-api-2026-10-26');
    expect(name('Đặt hàng / Orders')).toBe('dat-hang-orders-2026-10-26');
    expect(name('???')).toBe('project-2026-10-26');
  });
});

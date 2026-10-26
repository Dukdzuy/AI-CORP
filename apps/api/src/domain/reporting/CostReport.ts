/**
 * Cost report (Phase 5, Task 23)
 *
 * Built from LLM usage records. Pure: no database, so the arithmetic is unit-tested on its
 * own and the same builder serves the API, the exports and the weekly report.
 *
 * @pattern Builder
 */
export interface UsageRecord {
  agentRole: string;
  model: string;
  cost: number;
  totalTokens: number;
  responseTimeMs: number;
  fallback: boolean;
  createdAt: Date;
}

export interface CostBucket {
  key: string;
  cost: number;
  tokens: number;
  calls: number;
  share: number; // of total cost, 0..1
}

export interface CostReport {
  projectId: string | null;
  generatedAt: string;
  currency: 'USD';
  total: number;
  totalTokens: number;
  calls: number;
  fallbackCalls: number;
  avgResponseTimeMs: number;
  budget: number | null;
  budgetUsed: number | null; // 0..1+, null without a budget
  byAgent: CostBucket[];
  byModel: CostBucket[];
  byDay: Array<{ date: string; cost: number; calls: number }>;
}

const round = (n: number, digits = 6) => Math.round(n * 10 ** digits) / 10 ** digits;

export class CostReportBuilder {
  static build(projectId: string | null, records: readonly UsageRecord[], budget: number | null, now = new Date()): CostReport {
    const total = records.reduce((s, r) => s + r.cost, 0);
    const bucket = (keyOf: (r: UsageRecord) => string): CostBucket[] => {
      const map = new Map<string, { cost: number; tokens: number; calls: number }>();
      for (const r of records) {
        const k = keyOf(r);
        const b = map.get(k) ?? { cost: 0, tokens: 0, calls: 0 };
        b.cost += r.cost;
        b.tokens += r.totalTokens;
        b.calls += 1;
        map.set(k, b);
      }
      return [...map.entries()]
        .map(([key, b]) => ({ key, cost: round(b.cost), tokens: b.tokens, calls: b.calls, share: total > 0 ? round(b.cost / total, 4) : 0 }))
        .sort((a, b) => b.cost - a.cost || a.key.localeCompare(b.key));
    };

    const days = new Map<string, { cost: number; calls: number }>();
    for (const r of records) {
      const d = r.createdAt.toISOString().slice(0, 10);
      const e = days.get(d) ?? { cost: 0, calls: 0 };
      e.cost += r.cost;
      e.calls += 1;
      days.set(d, e);
    }

    return {
      projectId,
      generatedAt: now.toISOString(),
      currency: 'USD',
      total: round(total),
      totalTokens: records.reduce((s, r) => s + r.totalTokens, 0),
      calls: records.length,
      fallbackCalls: records.filter(r => r.fallback).length,
      avgResponseTimeMs: records.length ? Math.round(records.reduce((s, r) => s + r.responseTimeMs, 0) / records.length) : 0,
      budget,
      budgetUsed: budget && budget > 0 ? round(total / budget, 4) : null,
      byAgent: bucket(r => r.agentRole),
      byModel: bucket(r => r.model),
      byDay: [...days.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, e]) => ({ date, cost: round(e.cost), calls: e.calls })),
    };
  }
}

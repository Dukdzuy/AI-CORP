import type { DailyPoint, HeatmapCell } from '../../lib/api/hooks/analytics';

/** Pure formatting helpers of the analytics views (Phase 6), kept out of the components to be tested */

export const pct = (n: number | null | undefined) => (n === null || n === undefined ? '–' : `${Math.round(n * 100)}%`);
export const usd = (n: number | null | undefined, digits = 4) => (n === null || n === undefined ? '–' : `$${n.toFixed(digits)}`);

export function duration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '–';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)} s`;
  const m = Math.floor(s / 60);
  return `${m} min ${Math.round(s % 60)} s`;
}

/** Signed change: points for rates (0.1 → "+10 pts"), percent for relative changes (0.5 → "+50%") */
export function trendText(value: number | null, kind: 'points' | 'relative'): string {
  if (value === null) return '–';
  const n = Math.round(value * 100);
  const sign = n > 0 ? '+' : '';
  return kind === 'points' ? `${sign}${n} pts` : `${sign}${n}%`;
}

/** Whether a change is good, bad or neutral: higher is better for rates, lower for time and cost */
export function trendTone(value: number | null, higherIsBetter: boolean, tolerance = 0.05): 'good' | 'bad' | 'neutral' {
  if (value === null || Math.abs(value) < tolerance) return 'neutral';
  return value > 0 === higherIsBetter ? 'good' : 'bad';
}

/** One row per day with a column per role, for a multi-line chart */
export function successSeries(daily: readonly DailyPoint[]): { rows: Array<Record<string, string | number | null>>; roles: string[] } {
  const roles = [...new Set(daily.map(d => d.role))].sort();
  const byDate = new Map<string, Record<string, string | number | null>>();
  for (const d of daily) {
    if (!byDate.has(d.date)) byDate.set(d.date, { date: d.date });
    byDate.get(d.date)![d.role] = d.successRate === null ? null : Math.round(d.successRate * 100);
  }
  return { rows: [...byDate.values()].sort((a, b) => String(a.date).localeCompare(String(b.date))), roles };
}

/** 7 × 24 matrix (rows: Monday first) and its maximum */
export function heatmapMatrix(cells: readonly HeatmapCell[]): { rows: Array<{ label: string; counts: number[] }>; max: number } {
  const order = [1, 2, 3, 4, 5, 6, 0];
  const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const counts = new Map(cells.map(c => [`${c.weekday}|${c.hour}`, c.count]));
  const rows = order.map(day => ({ label: labels[day], counts: Array.from({ length: 24 }, (_, h) => counts.get(`${day}|${h}`) ?? 0) }));
  return { rows, max: Math.max(0, ...cells.map(c => c.count)) };
}

export const SCORE_COLOR = (score: number | null, threshold = 70) =>
  score === null ? 'default' : score >= Math.max(threshold, 85) ? 'green' : score >= threshold ? 'gold' : 'red';

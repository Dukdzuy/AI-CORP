import { describe, expect, it } from 'vitest';
import { SCORE_COLOR, duration, heatmapMatrix, pct, successSeries, trendText, trendTone, usd } from '../analyticsFormat';

describe('analytics formatting (Phase 6)', () => {
  it('formats percentages, money and durations', () => {
    expect(pct(0.456)).toBe('46%');
    expect(pct(null)).toBe('–');
    expect(usd(0.12345)).toBe('$0.1235');
    expect(usd(undefined)).toBe('–');
    expect(duration(450)).toBe('450 ms');
    expect(duration(12_300)).toBe('12.3 s');
    expect(duration(125_000)).toBe('2 min 5 s');
    expect(duration(null)).toBe('–');
  });

  it('describes trends and whether they are good news', () => {
    expect(trendText(0.1, 'points')).toBe('+10 pts');
    expect(trendText(-0.5, 'relative')).toBe('-50%');
    expect(trendText(null, 'points')).toBe('–');
    expect(trendTone(0.2, true)).toBe('good');
    expect(trendTone(0.2, false)).toBe('bad');
    expect(trendTone(-0.01, true)).toBe('neutral');
    expect(trendTone(null, true)).toBe('neutral');
  });

  it('pivots daily points into chart rows with one column per role', () => {
    const { rows, roles } = successSeries([
      { date: '2026-10-21', role: 'QA', executions: 1, successRate: 1 },
      { date: '2026-10-20', role: 'DEV', executions: 2, successRate: 0.5 },
      { date: '2026-10-21', role: 'DEV', executions: 1, successRate: null },
    ]);
    expect(roles).toEqual(['DEV', 'QA']);
    expect(rows).toEqual([{ date: '2026-10-20', DEV: 50 }, { date: '2026-10-21', QA: 100, DEV: null }]);
  });

  it('builds a Monday-first 7 × 24 heatmap', () => {
    const { rows, max } = heatmapMatrix([{ weekday: 1, hour: 9, count: 3 }, { weekday: 0, hour: 23, count: 1 }]);
    expect(rows.map(r => r.label)).toEqual(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    expect(rows[0].counts[9]).toBe(3);
    expect(rows[6].counts[23]).toBe(1);
    expect(rows.every(r => r.counts.length === 24)).toBe(true);
    expect(max).toBe(3);
    expect(heatmapMatrix([]).max).toBe(0);
  });

  it('colours scores against the threshold', () => {
    expect(SCORE_COLOR(90)).toBe('green');
    expect(SCORE_COLOR(75)).toBe('gold');
    expect(SCORE_COLOR(40)).toBe('red');
    expect(SCORE_COLOR(null)).toBe('default');
  });
});

import type { QualityGateChecklistItem, QualityGateResultEvent, QualityWarningEvent } from '@ai-corp/shared-types';
import type { QualityGateRecord } from '../../lib/api/hooks/artifacts';

/** A gate evaluation as the panel shows it, from the REST history or a live event */
export interface GateView {
  gateId: string;
  passed: boolean;
  score: number;
  checklist: QualityGateChecklistItem[];
  at: string;
  live: boolean;
}

export interface WarningView extends QualityWarningEvent {
  at: string;
}

/**
 * Socket payloads arrive as { type, payload } (project_event) or as the bare payload;
 * returns the payload either way.
 */
export function unwrapEvent<T>(event: unknown): T | null {
  if (!event || typeof event !== 'object') return null;
  const e = event as { payload?: unknown; data?: unknown };
  return ((e.payload ?? e.data ?? event) as T) || null;
}

export function gateFromEvent(event: unknown, at = new Date().toISOString()): GateView | null {
  const payload = unwrapEvent<QualityGateResultEvent>(event);
  if (!payload || typeof payload.gateId !== 'string' || !Array.isArray(payload.checklist)) return null;
  return { gateId: payload.gateId, passed: !!payload.passed, score: payload.score ?? 0, checklist: payload.checklist, at, live: true };
}

export function gateFromRecord(record: QualityGateRecord): GateView {
  return { gateId: record.gateId, passed: record.passed, score: record.score, checklist: record.checklist, at: record.timestamp, live: false };
}

/** Latest evaluation per gate id, newest first; live events win over older history */
export function latestGates(history: QualityGateRecord[], live: GateView[]): GateView[] {
  const all = [...live, ...history.map(gateFromRecord)].sort((a, b) => b.at.localeCompare(a.at));
  const seen = new Set<string>();
  return all.filter(g => (seen.has(g.gateId) ? false : (seen.add(g.gateId), true)));
}

export function warningFromEvent(event: unknown, at = new Date().toISOString()): WarningView | null {
  const payload = unwrapEvent<QualityWarningEvent>(event);
  if (!payload || typeof payload.message !== 'string') return null;
  return { ...payload, severity: payload.severity || 'warning', at };
}

/** Newest first, identical consecutive messages collapsed, capped */
export function addWarning(list: WarningView[], warning: WarningView, max = 20): WarningView[] {
  if (list[0]?.message === warning.message) return [warning, ...list.slice(1)];
  return [warning, ...list].slice(0, max);
}

/** "6 (expected >= 5)" style text for a checklist row */
export function describeCheck(item: QualityGateChecklistItem): string {
  const actual = item.actual === undefined ? '' : String(item.actual);
  const expected = item.expected === undefined ? '' : String(item.expected);
  if (actual && expected) return `${actual} (expected ${expected})`;
  return actual || expected;
}

import { describe, expect, it } from 'vitest';
import { addWarning, describeCheck, gateFromEvent, latestGates, unwrapEvent, warningFromEvent } from '../qualityGate';

const checklist = [
  { name: 'Use cases', actual: 6, expected: '>= 5', passed: true },
  { name: 'Artifact: docs/class-diagram.puml', actual: 'missing', expected: 'exists', passed: false },
];

describe('quality gate events', () => {
  it('reads the payload from the project_event envelope or a bare payload', () => {
    const payload = { gateId: 'ooad_gate', passed: false, score: 50, checklist };
    expect(unwrapEvent({ type: 'quality_gate_result', payload })).toBe(payload);
    expect(unwrapEvent(payload)).toBe(payload);
    expect(unwrapEvent(null)).toBeNull();
  });

  it('turns a gate event into a live view and rejects malformed events', () => {
    expect(gateFromEvent({ type: 'quality_gate_result', payload: { gateId: 'ooad_gate', passed: false, score: 50, checklist } }, '2026-10-26T12:00:00Z'))
      .toEqual({ gateId: 'ooad_gate', passed: false, score: 50, checklist, at: '2026-10-26T12:00:00Z', live: true });
    expect(gateFromEvent({ payload: { passed: true } })).toBeNull();
  });

  it('keeps the latest evaluation per gate, live events included', () => {
    const history = [
      { id: '2', gateId: 'ooad_gate', passed: false, score: 50, checklist, timestamp: '2026-10-26T10:00:00Z' },
      { id: '1', gateId: 'ooad_gate', passed: false, score: 25, checklist, timestamp: '2026-10-26T09:00:00Z' },
      { id: '3', gateId: 'code_gate', passed: true, score: 100, checklist: [], timestamp: '2026-10-26T08:00:00Z' },
    ];
    const live = [{ gateId: 'ooad_gate', passed: true, score: 100, checklist: [], at: '2026-10-26T11:00:00Z', live: true }];

    const gates = latestGates(history, live);
    expect(gates.map(g => [g.gateId, g.score, g.live])).toEqual([['ooad_gate', 100, true], ['code_gate', 100, false]]);
    expect(latestGates(history, []).map(g => g.score)).toEqual([50, 100]);
  });

  it('describes a checklist row', () => {
    expect(describeCheck(checklist[0])).toBe('6 (expected >= 5)');
    expect(describeCheck({ name: 'x', passed: true })).toBe('');
  });
});

describe('quality warnings', () => {
  it('collapses repeats and caps the list', () => {
    const w = (message: string) => warningFromEvent({ type: 'quality_warning', payload: { message, severity: 'warning', failingUseCases: ['UC-001'] } })!;
    expect(w('a')).toEqual(expect.objectContaining({ message: 'a', failingUseCases: ['UC-001'] }));
    let list = addWarning([], w('a'));
    list = addWarning(list, w('a'));
    expect(list).toHaveLength(1);
    for (let i = 0; i < 30; i++) list = addWarning(list, w(`m${i}`));
    expect(list).toHaveLength(20);
    expect(list[0].message).toBe('m29');
    expect(warningFromEvent({ payload: {} })).toBeNull();
  });
});

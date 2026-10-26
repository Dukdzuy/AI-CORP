/** How the audit page shows an entry's `changes` (Phase 5, Task 21); pure, unit-tested */
export type ChangesView =
  | { kind: 'diff'; rows: Array<{ field: string; from: string; to: string }> }
  | { kind: 'raw'; text: string };

const show = (v: unknown): string => (v === undefined || v === null ? '—' : typeof v === 'object' ? JSON.stringify(v) : String(v));

export function describeChanges(changes: unknown): ChangesView {
  const diff = (changes as any)?.diff;
  if (Array.isArray(diff) && diff.length) {
    return { kind: 'diff', rows: diff.map((d: any) => ({ field: String(d.field), from: show(d.from), to: show(d.to) })) };
  }
  if (Array.isArray(diff) && !diff.length) return { kind: 'raw', text: 'No field changed.' };
  return { kind: 'raw', text: JSON.stringify(changes, null, 2) };
}

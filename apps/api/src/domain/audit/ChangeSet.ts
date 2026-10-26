/**
 * ChangeSet Value Object (Phase 5, Task 21)
 *
 * The before/after state of a resource touched by an action, plus the list of fields that
 * changed. Values are compared by their JSON form, so dates and decimals compare as text.
 *
 * @pattern Value Object
 */
export interface FieldChange {
  field: string;
  from: unknown;
  to: unknown;
}

/** Fields never written to the audit log, whatever resource they belong to */
const SECRET_FIELD = /pass(word)?|secret|token|api[-_]?key|authorization|hash/i;
const REDACTED = '[redacted]';
/** Bookkeeping fields that change on every write; kept in before/after, left out of the diff */
const NOT_A_CHANGE = new Set(['updatedAt']);

export class ChangeSet {
  private constructor(
    readonly before: Record<string, unknown> | null,
    readonly after: Record<string, unknown> | null,
    readonly diff: FieldChange[]
  ) {}

  static between(before: unknown, after: unknown): ChangeSet {
    const b = ChangeSet.flatten(before);
    const a = ChangeSet.flatten(after);
    const fields = new Set([...Object.keys(b ?? {}), ...Object.keys(a ?? {})]);
    const diff: FieldChange[] = [];
    for (const field of fields) {
      if (NOT_A_CHANGE.has(field)) continue;
      const from = b?.[field];
      const to = a?.[field];
      if (JSON.stringify(from) !== JSON.stringify(to)) diff.push({ field, from, to });
    }
    return new ChangeSet(b, a, diff);
  }

  hasChanges(): boolean {
    return this.diff.length > 0;
  }

  toJSON() {
    return { before: this.before, after: this.after, diff: this.diff };
  }

  /** Deep copy with secrets masked; used for request bodies too */
  static redact(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined || depth > 6) return value ?? null;
    if (Array.isArray(value)) return value.map(v => ChangeSet.redact(v, depth + 1));
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = SECRET_FIELD.test(k) ? REDACTED : ChangeSet.redact(v, depth + 1);
      }
      return out;
    }
    return value;
  }

  /**
   * Keeps the scalar fields of a resource (nested objects and arrays such as
   * tasks or ooadMetadata are summarised, not copied) and masks secrets.
   */
  private static flatten(value: unknown): Record<string, unknown> | null {
    if (value === null || value === undefined || typeof value !== 'object') return null;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_FIELD.test(k)) continue;
      if (v instanceof Date) out[k] = v.toISOString();
      else if (Array.isArray(v)) out[k] = `[${v.length} items]`;
      else if (v !== null && typeof v === 'object') {
        // Prisma Decimal and similar wrappers serialise to a string
        const str = (v as { toString(): string }).toString();
        if (str !== '[object Object]') out[k] = str;
      } else out[k] = v;
    }
    return out;
  }
}

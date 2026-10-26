/**
 * Security anomaly detection over the audit trail (Phase 5, Task 21)
 *
 * Each rule inspects a time-ordered window of entries and reports suspicious patterns.
 * Rules are independent strategies, so a new rule needs no change to the detector.
 *
 * @pattern Strategy, Composite (the detector runs every rule)
 */
import { AuditEntry } from './AuditEntry';

export type AnomalySeverity = 'warning' | 'critical';

export interface SecurityAnomaly {
  rule: string;
  severity: AnomalySeverity;
  subject: string;
  count: number;
  firstAt: Date;
  lastAt: Date;
  message: string;
}

export interface IAnomalyRule {
  readonly name: string;
  detect(entries: readonly AuditEntry[]): SecurityAnomaly[];
}

/**
 * Groups matching entries by a subject and reports every subject that has `threshold`
 * matches inside any sliding window of `windowMs`.
 */
abstract class ThresholdRule implements IAnomalyRule {
  abstract readonly name: string;
  constructor(protected readonly threshold: number, protected readonly windowMs: number) {}

  protected abstract matches(entry: AuditEntry): boolean;
  protected abstract subjectsOf(entry: AuditEntry): string[];
  protected abstract describe(subject: string, count: number): string;
  protected severityFor(count: number): AnomalySeverity {
    return count >= this.threshold * 2 ? 'critical' : 'warning';
  }

  detect(entries: readonly AuditEntry[]): SecurityAnomaly[] {
    const bySubject = new Map<string, AuditEntry[]>();
    for (const e of entries) {
      if (!this.matches(e)) continue;
      for (const s of this.subjectsOf(e)) {
        if (!bySubject.has(s)) bySubject.set(s, []);
        bySubject.get(s)!.push(e);
      }
    }

    const anomalies: SecurityAnomaly[] = [];
    for (const [subject, list] of bySubject) {
      const sorted = [...list].sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      let best: { count: number; first: Date; last: Date } | null = null;
      let start = 0;
      for (let end = 0; end < sorted.length; end++) {
        while (sorted[end].timestamp.getTime() - sorted[start].timestamp.getTime() > this.windowMs) start++;
        const count = end - start + 1;
        if (count >= this.threshold && (!best || count > best.count)) {
          best = { count, first: sorted[start].timestamp, last: sorted[end].timestamp };
        }
      }
      if (best) {
        anomalies.push({
          rule: this.name,
          severity: this.severityFor(best.count),
          subject,
          count: best.count,
          firstAt: best.first,
          lastAt: best.last,
          message: this.describe(subject, best.count),
        });
      }
    }
    return anomalies;
  }
}

/** Brute force: many failed logins for one account or from one IP address */
export class RepeatedFailedLoginRule extends ThresholdRule {
  readonly name = 'repeated_failed_login';
  constructor(threshold = 5, windowMs = 15 * 60_000) {
    super(threshold, windowMs);
  }
  protected matches(e: AuditEntry) {
    return e.action === 'auth.login' && !e.success;
  }
  protected subjectsOf(e: AuditEntry) {
    const subjects: string[] = [];
    if (e.actor.label) subjects.push(`account ${e.actor.label}`);
    if (e.ipAddress) subjects.push(`ip ${e.ipAddress}`);
    return subjects;
  }
  protected describe(subject: string, count: number) {
    return `${count} failed logins for ${subject} within ${Math.round(this.windowMs / 60_000)} min`;
  }
}

/** Privilege probing: one actor hitting many endpoints it is not allowed to use */
export class AccessDeniedBurstRule extends ThresholdRule {
  readonly name = 'access_denied_burst';
  constructor(threshold = 10, windowMs = 10 * 60_000) {
    super(threshold, windowMs);
  }
  protected matches(e: AuditEntry) {
    return e.action === 'access.denied';
  }
  protected subjectsOf(e: AuditEntry) {
    return [e.actor.label || e.actor.userId || e.ipAddress || 'unknown'];
  }
  protected describe(subject: string, count: number) {
    return `${count} denied requests by ${subject} within ${Math.round(this.windowMs / 60_000)} min`;
  }
}

export class AnomalyDetector {
  constructor(private readonly rules: readonly IAnomalyRule[] = [new RepeatedFailedLoginRule(), new AccessDeniedBurstRule()]) {}

  detect(entries: readonly AuditEntry[]): SecurityAnomaly[] {
    return this.rules
      .flatMap(rule => rule.detect(entries))
      .sort((a, b) => b.lastAt.getTime() - a.lastAt.getTime());
  }
}

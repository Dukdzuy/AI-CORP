import { AccessDeniedBurstRule, AnomalyDetector, AuditEntry, ChangeSet, RepeatedFailedLoginRule } from '../../../src/domain/audit';

const at = (min: number) => new Date(Date.UTC(2026, 9, 26, 8, 0) + min * 60_000);
const failedLogin = (min: number, email: string, ip = '10.0.0.1') =>
  AuditEntry.record({ actor: { type: 'anonymous', label: email }, action: 'auth.login', resourceType: 'Auth', success: false, ipAddress: ip, timestamp: at(min) });

describe('Phase 5 / Task 21: audit domain', () => {
  describe('AuditEntry', () => {
    it('validates the action name and resource type', () => {
      expect(() => AuditEntry.record({ actor: { type: 'system' }, action: 'Create Project', resourceType: 'Project' })).toThrow(/dotted lower-case/);
      expect(() => AuditEntry.record({ actor: { type: 'system' }, action: 'project', resourceType: 'Project' })).toThrow();
      expect(() => AuditEntry.record({ actor: { type: 'system' }, action: 'project.create', resourceType: '' })).toThrow(/resource type/);
    });

    it('defaults id, time and success, and is immutable', () => {
      const e = AuditEntry.record({ actor: { type: 'system' }, action: 'workflow.completed', resourceType: 'Workflow' });
      expect(e.id).toMatch(/[0-9a-f-]{36}/);
      expect(e.success).toBe(true);
      expect(Object.isFrozen(e.toPrimitives()) || Object.isFrozen((e as any).props)).toBe(true);
    });

    it('redacts secrets in recorded request bodies at any depth', () => {
      const e = AuditEntry.record({
        actor: { type: 'anonymous' },
        action: 'auth.login',
        resourceType: 'Auth',
        changes: { request: { email: 'a@x.com', password: 'hunter2', nested: { apiKey: 'k', token: 't', keep: 1 } } },
      });
      expect(e.changes).toEqual({ request: { email: 'a@x.com', password: '[redacted]', nested: { apiKey: '[redacted]', token: '[redacted]', keep: 1 } } });
    });

    it('truncates very long error messages', () => {
      const e = AuditEntry.record({ actor: { type: 'system' }, action: 'workflow.failed', resourceType: 'Workflow', errorMessage: 'x'.repeat(5000) });
      expect(e.errorMessage).toHaveLength(2000);
    });
  });

  describe('ChangeSet', () => {
    it('lists the fields that changed, ignoring updatedAt', () => {
      const before = { id: 'p', name: 'Shop', budget: 5, updatedAt: new Date(1), tasks: [1, 2] };
      const after = { id: 'p', name: 'Shop', budget: 12, updatedAt: new Date(2), tasks: [1, 2, 3] };
      const cs = ChangeSet.between(before, after);
      expect(cs.diff).toEqual([
        { field: 'budget', from: 5, to: 12 },
        { field: 'tasks', from: '[2 items]', to: '[3 items]' },
      ]);
      expect(cs.before?.updatedAt).toBe(new Date(1).toISOString());
    });

    it('handles create (no before) and delete (no after), and drops secret fields', () => {
      expect(ChangeSet.between(null, { a: 1, passwordHash: 'x' }).diff).toEqual([{ field: 'a', from: undefined, to: 1 }]);
      expect(ChangeSet.between({ a: 1 }, null).toJSON()).toEqual({ before: { a: 1 }, after: null, diff: [{ field: 'a', from: 1, to: undefined }] });
      expect(ChangeSet.between({ a: 1 }, { a: 1 }).hasChanges()).toBe(false);
    });

    it('serialises decimal-like wrappers through toString', () => {
      const decimal = { toString: () => '10.50' };
      expect(ChangeSet.between({ budget: decimal }, { budget: { toString: () => '12.00' } }).diff[0]).toEqual({ field: 'budget', from: '10.50', to: '12.00' });
    });
  });

  describe('anomaly rules', () => {
    it('flags 5 failed logins for one account within 15 minutes, per account and per IP', () => {
      const entries = [0, 2, 4, 6, 8].map(m => failedLogin(m, 'eve@x.com'));
      const found = new RepeatedFailedLoginRule().detect(entries);
      expect(found.map(a => a.subject).sort()).toEqual(['account eve@x.com', 'ip 10.0.0.1']);
      expect(found[0]).toMatchObject({ rule: 'repeated_failed_login', count: 5, severity: 'warning' });
    });

    it('uses a sliding window: spread-out failures are not an attack', () => {
      const entries = [0, 10, 20, 30, 40].map(m => failedLogin(m, 'eve@x.com'));
      expect(new RepeatedFailedLoginRule().detect(entries)).toEqual([]);
    });

    it('raises severity to critical at twice the threshold, and ignores successes', () => {
      const entries = Array.from({ length: 10 }, (_, i) => failedLogin(i, 'eve@x.com', `10.0.0.${i}`));
      entries.push(AuditEntry.record({ actor: { type: 'user', label: 'eve@x.com' }, action: 'auth.login', resourceType: 'Auth', success: true, timestamp: at(11) }));
      const account = new RepeatedFailedLoginRule().detect(entries).find(a => a.subject === 'account eve@x.com')!;
      expect(account).toMatchObject({ count: 10, severity: 'critical' });
      expect(account.firstAt).toEqual(at(0));
      expect(account.lastAt).toEqual(at(9));
    });

    it('flags bursts of denied requests per actor', () => {
      const denied = (m: number) => AuditEntry.record({ actor: { type: 'user', userId: 'b', label: 'bob@x.com' }, action: 'access.denied', resourceType: 'Access', success: false, timestamp: at(m) });
      const found = new AccessDeniedBurstRule(3, 60_000).detect([denied(0), denied(0.2), denied(0.5)]);
      expect(found).toMatchObject([{ rule: 'access_denied_burst', subject: 'bob@x.com', count: 3 }]);
    });

    it('the detector runs every rule and sorts newest first', () => {
      const logins = [0, 1, 2, 3, 4].map(m => failedLogin(m, 'eve@x.com'));
      const denied = [20, 20.1, 20.2].map(m => AuditEntry.record({ actor: { type: 'user', label: 'bob@x.com' }, action: 'access.denied', resourceType: 'Access', timestamp: at(m) }));
      const found = new AnomalyDetector([new RepeatedFailedLoginRule(), new AccessDeniedBurstRule(3)]).detect([...logins, ...denied]);
      expect(found[0].rule).toBe('access_denied_burst');
      expect(found).toHaveLength(3);
    });
  });
});

import { Permission } from '@ai-corp/shared-types';
import {
  ApiKey,
  ApiKeyError,
  FixedWindowRateLimiter,
  InvalidWebhookUrlError,
  Webhook,
  WebhookError,
  WebhookSignature,
  WebhookUrl,
} from '../../../src/domain/integration';
import { UserRole } from '../../../src/domain/security';

const issue = (overrides: Partial<Parameters<typeof ApiKey.issue>[0]> = {}) =>
  ApiKey.issue({ name: 'CI', ownerId: 'u1', ownerRole: UserRole.BOARD_MEMBER, scopes: [Permission.PROJECT_READ], ...overrides });

describe('Phase 5 / Task 22: integration domain', () => {
  describe('ApiKey', () => {
    it('issues a token that parses back to its key and matches only its own secret', () => {
      const { apiKey, token } = issue();
      const parsed = ApiKey.parse(token)!;
      expect(parsed.keyId).toBe(apiKey.id);
      expect(apiKey.matches(parsed.secret)).toBe(true);
      expect(apiKey.matches(parsed.secret.slice(0, -1) + 'x')).toBe(false);
      expect(ApiKey.parse('Bearer something')).toBeNull();
    });

    it('stores only a hash of the secret and never shows it', () => {
      const { apiKey, token } = issue();
      const secret = ApiKey.parse(token)!.secret;
      expect(JSON.stringify(apiKey.toPrimitives())).not.toContain(secret);
      expect(apiKey.toView()).not.toHaveProperty('secretHash');
      expect(apiKey.toView()).toMatchObject({ status: 'active', prefix: `aic_${apiKey.id}_…` });
    });

    it('refuses scopes the owner role does not have, unknown scopes and no scopes', () => {
      expect(() => issue({ scopes: [Permission.USER_MANAGE] })).toThrow(/cannot grant scope\(s\): user:manage/);
      expect(() => issue({ ownerRole: UserRole.VIEWER, scopes: [Permission.PROJECT_CREATE] })).toThrow(ApiKeyError);
      expect(() => issue({ scopes: ['project:fly'] })).toThrow(/Unknown scope/);
      expect(() => issue({ scopes: [] })).toThrow(/at least one scope/);
      expect(() => issue({ name: '  ' })).toThrow(/name/);
    });

    it('expires and can be revoked once', () => {
      const now = new Date('2026-10-26T00:00:00Z');
      const { apiKey } = issue({ now, expiresInDays: 1 });
      expect(apiKey.isUsable(new Date('2026-10-26T23:59:00Z'))).toBe(true);
      expect(apiKey.isUsable(new Date('2026-10-27T00:00:01Z'))).toBe(false);
      apiKey.revoke(now);
      expect(apiKey.isUsable(now)).toBe(false);
      expect(apiKey.toView().status).toBe('revoked');
      expect(() => apiKey.revoke()).toThrow(/already revoked/);
      expect(() => issue({ expiresInDays: 0 })).toThrow(/between 1 and 365/);
    });
  });

  describe('WebhookUrl', () => {
    it('accepts public http(s) URLs', () => {
      expect(WebhookUrl.parse('https://hooks.example.com/ai', { allowPrivateNetworks: false }).hostname).toBe('hooks.example.com');
    });

    it.each([
      ['ftp://example.com/x', /http or https/],
      ['https://user:pw@example.com/', /credentials/],
      ['not a url', /not a valid URL/],
      ['http://localhost:4000/x', /private or local/],
      ['http://127.0.0.1/x', /private/],
      ['http://10.1.2.3/x', /private/],
      ['http://172.20.0.5/x', /private/],
      ['http://192.168.1.10/x', /private/],
      ['http://169.254.169.254/latest/meta-data', /private/],
      ['http://[::1]/x', /private/],
      ['http://[fd00::1]/x', /private/],
      ['http://[::ffff:127.0.0.1]/x', /private/],
    ])('rejects %s', (url, message) => {
      expect(() => WebhookUrl.parse(url, { allowPrivateNetworks: false })).toThrow(message);
    });

    it('allows local receivers only when configured (development, e2e)', () => {
      expect(WebhookUrl.parse('http://127.0.0.1:4555/hook', { allowPrivateNetworks: true }).value).toBe('http://127.0.0.1:4555/hook');
      expect(() => WebhookUrl.parse('file:///etc/passwd', { allowPrivateNetworks: true })).toThrow(InvalidWebhookUrlError);
    });

    it('classifies addresses', () => {
      expect(WebhookUrl.isPrivateAddress('8.8.8.8')).toBe(false);
      expect(WebhookUrl.isPrivateAddress('172.32.0.1')).toBe(false);
      expect(WebhookUrl.isPrivateAddress('100.64.0.1')).toBe(true);
      expect(WebhookUrl.isPrivateAddress('2001:4860::8888')).toBe(false);
      expect(WebhookUrl.isPrivateAddress('example.com')).toBe(false);
    });
  });

  describe('Webhook', () => {
    const url = WebhookUrl.parse('https://example.com/h', { allowPrivateNetworks: false });

    it('subscribes to known events, globally or for one project', () => {
      const global = Webhook.register({ ownerId: 'u1', url, events: ['workflow.completed', 'workflow.completed'] });
      expect(global.events).toEqual(['workflow.completed']);
      expect(global.subscribesTo('workflow.completed', 'p1')).toBe(true);
      expect(global.subscribesTo('workflow.started', 'p1')).toBe(false);

      const scoped = Webhook.register({ ownerId: 'u1', url, events: ['workflow.completed'], projectId: 'p1' });
      expect(scoped.subscribesTo('workflow.completed', 'p1')).toBe(true);
      expect(scoped.subscribesTo('workflow.completed', 'p2')).toBe(false);
      scoped.deactivate();
      expect(scoped.subscribesTo('workflow.completed', 'p1')).toBe(false);
    });

    it('rejects unknown or missing events', () => {
      expect(() => Webhook.register({ ownerId: 'u1', url, events: ['task.exploded'] })).toThrow(/Unknown event/);
      expect(() => Webhook.register({ ownerId: 'u1', url, events: [] })).toThrow(WebhookError);
    });

    it('shows the signing secret only when asked (at creation)', () => {
      const w = Webhook.register({ ownerId: 'u1', url, events: ['project.created'] });
      expect(w.secret).toMatch(/^whsec_/);
      expect(w.toView(true)).toHaveProperty('secret', w.secret);
      expect(w.toView()).not.toHaveProperty('secret');
    });
  });

  describe('WebhookSignature', () => {
    it('signs timestamp + body and verifies within the tolerance', () => {
      const ts = 1_800_000_000;
      const sig = WebhookSignature.sign('whsec_x', ts, '{"a":1}');
      expect(sig).toMatch(/^sha256=[0-9a-f]{64}$/);
      expect(WebhookSignature.verify('whsec_x', ts, '{"a":1}', sig, 300, ts * 1000 + 10_000)).toBe(true);
      expect(WebhookSignature.verify('whsec_x', ts, '{"a":2}', sig, 300, ts * 1000)).toBe(false);
      expect(WebhookSignature.verify('whsec_y', ts, '{"a":1}', sig, 300, ts * 1000)).toBe(false);
      // replay of an old delivery
      expect(WebhookSignature.verify('whsec_x', ts, '{"a":1}', sig, 300, ts * 1000 + 301_000)).toBe(false);
    });
  });

  describe('FixedWindowRateLimiter', () => {
    it('allows `limit` hits per window per key, then reports when to retry', () => {
      let now = 0;
      const limiter = new FixedWindowRateLimiter(() => now);
      const hits = Array.from({ length: 4 }, () => limiter.hit('k', 3, 60_000));
      expect(hits.map(h => h.allowed)).toEqual([true, true, true, false]);
      expect(hits[2].remaining).toBe(0);
      expect(hits[3]).toMatchObject({ retryAfterSec: 60, resetAt: 60_000 });
      expect(limiter.hit('other', 3, 60_000).allowed).toBe(true);

      now = 45_000;
      expect(limiter.hit('k', 3, 60_000).retryAfterSec).toBe(15);
      now = 60_000;
      expect(limiter.hit('k', 3, 60_000)).toMatchObject({ allowed: true, remaining: 2 });
    });
  });
});

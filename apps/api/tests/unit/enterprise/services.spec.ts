import { ConflictException, ForbiddenException, Logger } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { Principal } from '../../../src/domain/security';
import { AuditLogService } from '../../../src/modules/audit/audit-log.service';
import { AuditLogHandler } from '../../../src/modules/events/handlers/AuditLogHandler';
import { UserAdminService } from '../../../src/modules/users/user-admin.service';
import { IntegrationsService } from '../../../src/modules/integrations/integrations.service';
import { AuthorizationService } from '../../../src/modules/access/authorization.service';
import { WorkflowFailedEvent } from '../../../src/domain/events/WorkflowFailedEvent';
import { TaskCompletedEvent } from '../../../src/domain/events/TaskCompletedEvent';
import { QualityGateEvaluatedEvent } from '../../../src/domain/events/QualityGateEvaluatedEvent';
import { ProjectCreatedEvent } from '../../../src/domain/events/ProjectCreatedEvent';
import { InMemoryApiKeyRepository, InMemoryAuditLogRepository, InMemoryWebhookRepository } from './in-memory';

const principal = (id: string, role: string) => Principal.forUser({ id, email: `${id}@x.com`, name: id, role });

describe('Phase 5: application services', () => {
  beforeAll(() => jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined));
  afterAll(() => jest.restoreAllMocks());

  describe('AuditLogHandler (domain events → audit trail)', () => {
    const setup = () => {
      const repo = new InMemoryAuditLogRepository();
      return { repo, handler: new AuditLogHandler(new AuditLogService(repo)) };
    };

    it('records system and agent actions with the event time', async () => {
      const { repo, handler } = setup();
      const failed = new WorkflowFailedEvent('p1', 'r1', 'develop', 'DEV failed 3 times');
      await handler.handle(failed);
      await handler.handle(new TaskCompletedEvent('t1', 'p1', 'DEV', 'Implement UC-001', 1200));
      await handler.handle(new QualityGateEvaluatedEvent('p1', 'ooad_gate', false, 60, ['Use cases: 2 (expected >= 5)']));

      const [wf, task, gate] = repo.entries;
      expect(wf).toMatchObject({ action: 'workflow.failed', resourceId: 'r1', projectId: 'p1', success: false, errorMessage: 'DEV failed 3 times' });
      expect(wf.actor.type).toBe('system');
      expect(wf.timestamp).toEqual(failed.occurredOn);
      expect(task).toMatchObject({ action: 'agent.task_completed', resourceType: 'Task' });
      expect(task.actor).toMatchObject({ type: 'agent', agentRole: 'DEV' });
      expect(gate).toMatchObject({ action: 'quality.gate.evaluated', success: false, errorMessage: 'Use cases: 2 (expected >= 5)' });
    });

    it('skips events that only echo a user request (already audited over HTTP)', async () => {
      const { repo, handler } = setup();
      await handler.handle(new ProjectCreatedEvent('p1', 'Shop', 'u1'));
      expect(repo.entries).toHaveLength(0);
      expect(AuditLogHandler.eventTypes()).not.toContain('project.created');
    });

    it('a storage failure never breaks the audited operation', async () => {
      const service = new AuditLogService({ append: async () => { throw new Error('db down'); } } as any);
      await expect(service.record({ actor: { type: 'system' }, action: 'workflow.completed', resourceType: 'Workflow' })).resolves.toBeNull();
    });
  });

  describe('UserAdminService', () => {
    const make = (users: any[]) => {
      const prisma = {
        user: {
          findUnique: async ({ where }: any) => users.find(u => u.id === where.id) ?? null,
          count: async ({ where }: any) => users.filter(u => u.role === 'admin' && u.isActive && u.id !== where.id.not).length,
          update: async ({ where, data }: any) => Object.assign(users.find(u => u.id === where.id), data),
        },
        apiKey: { updateMany: jest.fn() },
        webhook: { updateMany: jest.fn() },
      };
      return { prisma, service: new UserAdminService(prisma as any, { register: jest.fn() } as any) };
    };
    const u = (id: string, role: string, isActive = true) => ({ id, email: `${id}@x`, name: id, role, isActive, createdAt: new Date() });

    it('keeps at least one active admin', async () => {
      const { service } = make([u('root', 'admin'), u('ops', 'admin')]);
      await expect(service.changeRole(principal('root', 'admin'), 'ops', 'board_member')).resolves.toMatchObject({ role: 'board_member' });
      const single = make([u('root', 'admin'), u('ops', 'admin', false)]);
      // ops is inactive, so demoting... root can't demote root (self), but another admin can't remove the last active one
      await expect(single.service.setActive(principal('ops', 'admin'), 'root', false)).rejects.toThrow(ConflictException);
    });

    it('forbids changing yourself', async () => {
      const { service } = make([u('root', 'admin'), u('ops', 'admin')]);
      await expect(service.changeRole(principal('root', 'admin'), 'root', 'viewer')).rejects.toThrow(/own role/);
      await expect(service.setActive(principal('root', 'admin'), 'root', false)).rejects.toThrow(/deactivate yourself/);
    });

    it('deactivating a user revokes their keys and silences their webhooks', async () => {
      const { service, prisma } = make([u('root', 'admin'), u('alice', 'board_member')]);
      await service.setActive(principal('root', 'admin'), 'alice', false);
      expect(prisma.apiKey.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ownerId: 'alice', revokedAt: null } }));
      expect(prisma.webhook.updateMany).toHaveBeenCalledWith({ where: { ownerId: 'alice' }, data: { active: false } });
    });
  });

  describe('IntegrationsService', () => {
    const make = () => {
      const keys = new InMemoryApiKeyRepository();
      const hooks = new InMemoryWebhookRepository();
      const audit = new InMemoryAuditLogRepository();
      const projects = { findById: async (id: string) => (id === 'p-alice' ? { id, createdById: 'alice' } : null) };
      const authorization = new AuthorizationService(new AuditLogService(audit), projects as any, {} as any, {} as any);
      const client = { allowPrivateNetworks: false } as any;
      const service = new IntegrationsService(keys, hooks, projects as any, authorization, client, { sendTest: jest.fn() } as any);
      return { service, keys, hooks, audit };
    };

    it('issues keys within the role and lists only your own (admins see all)', async () => {
      const { service } = make();
      const alice = principal('alice', 'board_member');
      const { token, apiKey } = await service.issueKey(alice, { name: 'CI', scopes: [Permission.PROJECT_READ] });
      expect(token).toMatch(/^aic_/);
      expect(apiKey).not.toHaveProperty('secretHash');
      await expect(service.issueKey(alice, { name: 'x', scopes: [Permission.AUDIT_VIEW] })).rejects.toThrow(/cannot grant/);
      await service.issueKey(principal('carol', 'board_member'), { name: 'C', scopes: [Permission.PROJECT_READ] });
      expect(await service.listKeys(alice)).toHaveLength(1);
      expect(await service.listKeys(principal('root', 'admin'))).toHaveLength(2);
    });

    it('only the owner or an admin revokes a key; the attempt is audited', async () => {
      const { service, audit } = make();
      const { apiKey } = await service.issueKey(principal('alice', 'board_member'), { name: 'CI', scopes: [Permission.PROJECT_READ] });
      await expect(service.revokeKey(principal('carol', 'board_member'), apiKey.id)).rejects.toThrow(ForbiddenException);
      expect(audit.actions()).toEqual(['access.denied']);
      await expect(service.revokeKey(principal('root', 'admin'), apiKey.id)).resolves.toMatchObject({ status: 'revoked' });
    });

    it('registers webhooks with URL rules, for your own projects only', async () => {
      const { service } = make();
      const alice = principal('alice', 'board_member');
      await expect(service.registerWebhook(alice, { url: 'http://192.168.0.2/x', events: ['workflow.completed'] })).rejects.toThrow(/private/);
      await expect(service.registerWebhook(principal('carol', 'board_member'), { url: 'https://example.com/h', events: ['workflow.completed'], projectId: 'p-alice' })).rejects.toThrow(ForbiddenException);
      await expect(service.registerWebhook(alice, { url: 'https://example.com/h', events: ['workflow.completed'], projectId: 'nope' })).rejects.toThrow(/not found/);
      const hook = await service.registerWebhook(alice, { url: 'https://example.com/h', events: ['workflow.completed'], projectId: 'p-alice' });
      expect(hook).toHaveProperty('secret');
      expect((await service.listWebhooks(alice))[0]).not.toHaveProperty('secret');
    });
  });
});

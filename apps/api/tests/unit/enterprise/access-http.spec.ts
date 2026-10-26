/**
 * Phase 5 (Tasks 20–22) through real HTTP: the global guards, the audit interceptor and
 * the controllers in one Nest app; persistence is in memory.
 */
import { INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as bcrypt from 'bcryptjs';
import { Permission } from '@ai-corp/shared-types';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { JwtStrategy } from '../../../src/modules/auth/jwt.strategy';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { AuthController } from '../../../src/modules/auth/auth.controller';
import { AuthenticationGuard } from '../../../src/modules/access/authentication.guard';
import { RateLimitGuard, RATE_LIMITER } from '../../../src/modules/access/rate-limit.guard';
import { PermissionGuard } from '../../../src/modules/access/permission.guard';
import { ApiKeyAuthenticator } from '../../../src/modules/access/api-key-authenticator.service';
import { AuthorizationService } from '../../../src/modules/access/authorization.service';
import { AuditLogService } from '../../../src/modules/audit/audit-log.service';
import { AuditInterceptor } from '../../../src/modules/audit/audit.interceptor';
import { AuditSnapshotRegistry } from '../../../src/modules/audit/audit-snapshot.registry';
import { AuditController } from '../../../src/modules/audit/audit.controller';
import { ProjectsController } from '../../../src/modules/projects/projects.controller';
import { ProjectApplicationService } from '../../../src/modules/projects/project-application.service';
import { UsersController } from '../../../src/modules/users/users.controller';
import { UserAdminService } from '../../../src/modules/users/user-admin.service';
import { IntegrationV1Controller } from '../../../src/modules/integrations/integration-v1.controller';
import { IntegrationsService } from '../../../src/modules/integrations/integrations.service';
import { ProjectReportingService } from '../../../src/modules/reporting/project-reporting.service';
import { ProjectExportService } from '../../../src/modules/reporting/project-export.service';
import { API_KEY_REPOSITORY, ApiKey, FixedWindowRateLimiter } from '../../../src/domain/integration';
import { AUDIT_LOG_REPOSITORY } from '../../../src/domain/audit';
import { APPROVAL_REPOSITORY, PROJECT_REPOSITORY, WORKFLOW_REPOSITORY } from '../../../src/domain/repositories';
import { UserRole } from '../../../src/domain/security';
import { InMemoryApiKeyRepository, InMemoryAuditLogRepository } from './in-memory';

const PASSWORD = 'secret123';

describe('Phase 5: access control, audit and integration API over HTTP', () => {
  let app: INestApplication;
  let base: string;
  let jwt: JwtService;
  const audit = new InMemoryAuditLogRepository();
  const keys = new InMemoryApiKeyRepository();
  const users: any[] = [];
  const project = { id: 'p-alice', name: 'Shop', createdById: 'alice', budget: 5, status: 'active' };

  const prisma = {
    isReady: () => true,
    user: {
      findUnique: jest.fn(async ({ where }: any) => users.find(u => (where.id ? u.id === where.id : u.email === where.email)) ?? null),
      findMany: jest.fn(async () => users),
      count: jest.fn(async ({ where }: any) => users.filter(u => u.role === where.role && u.isActive === where.isActive && u.id !== where.id.not).length),
      update: jest.fn(async ({ where, data }: any) => Object.assign(users.find(u => u.id === where.id), data)),
    },
    apiKey: { updateMany: jest.fn() },
    webhook: { updateMany: jest.fn() },
  };
  const projectService = {
    listProjects: jest.fn(async () => [project]),
    createProject: jest.fn(async (data: any) => ({ id: 'p-new', name: data.name, status: 'active', createdById: data.createdById })),
    getProjectDetails: jest.fn(async () => project),
    updateProject: jest.fn(async (_id: string, data: any) => Object.assign(project, data)),
    deleteProject: jest.fn(),
  };

  const tokenFor = (id: string) => jwt.sign({ sub: id, email: `${id}@x.com`, role: 'ignored' });
  const req = (method: string, path: string, opts: { token?: string; apiKey?: string; body?: unknown } = {}) =>
    fetch(`${base}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.apiKey ? { 'x-api-key': opts.apiKey } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
    });
  const issueKey = async (owner: string, scopes: Permission[]) => {
    const role = users.find(u => u.id === owner).role;
    const { apiKey, token } = ApiKey.issue({ name: 'test', ownerId: owner, ownerRole: UserRole.fromString(role), scopes });
    await keys.save(apiKey);
    return { apiKey, token };
  };

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    const hash = await bcrypt.hash(PASSWORD, 4);
    for (const [id, role, isActive] of [['admin', 'admin', true], ['alice', 'board_member', true], ['carol', 'board_member', true], ['bob', 'viewer', true], ['dave', 'board_member', false]] as const) {
      users.push({ id, email: `${id}@x.com`, name: id, role, isActive, passwordHash: hash, createdAt: new Date() });
    }

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ ignoreEnvFile: true, load: [() => ({ JWT_SECRET: 'test-secret', API_RATE_LIMIT_PER_MINUTE: 5 })] }),
        PassportModule,
        JwtModule.register({ secret: 'test-secret' }),
      ],
      controllers: [AuthController, ProjectsController, UsersController, AuditController, IntegrationV1Controller],
      providers: [
        JwtStrategy,
        AuthService,
        ApiKeyAuthenticator,
        AuthorizationService,
        AuditLogService,
        AuditSnapshotRegistry,
        UserAdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: AUDIT_LOG_REPOSITORY, useValue: audit },
        { provide: API_KEY_REPOSITORY, useValue: keys },
        { provide: PROJECT_REPOSITORY, useValue: { findById: async (id: string) => (id === project.id ? project : null) } },
        { provide: WORKFLOW_REPOSITORY, useValue: { findRunById: async () => null } },
        { provide: APPROVAL_REPOSITORY, useValue: { findById: async () => null } },
        { provide: ProjectApplicationService, useValue: projectService },
        { provide: ProjectReportingService, useValue: { status: async (id: string) => ({ id, status: 'active' }) } },
        { provide: ProjectExportService, useValue: {} },
        { provide: IntegrationsService, useValue: {} },
        { provide: RATE_LIMITER, useValue: new FixedWindowRateLimiter() },
        { provide: APP_GUARD, useClass: AuthenticationGuard },
        { provide: APP_GUARD, useClass: RateLimitGuard },
        { provide: APP_GUARD, useClass: PermissionGuard },
        { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    app.get(AuditSnapshotRegistry).register('Project', async id => (id === project.id ? { ...project } : null));
    jwt = app.get(JwtService);
    await app.listen(0, '127.0.0.1');
    base = `${await app.getUrl()}/api`.replace('[::1]', '127.0.0.1');
  });

  afterAll(async () => {
    await app?.close();
    jest.restoreAllMocks();
  });

  describe('Task 20: authentication and permissions', () => {
    it('every route needs a caller unless @Public', async () => {
      expect((await req('GET', '/projects')).status).toBe(401);
      expect((await req('GET', '/projects', { token: 'not-a-jwt' })).status).toBe(401);
      expect((await req('POST', '/auth/login', { body: { email: 'alice@x.com', password: PASSWORD } })).status).toBe(201);
    });

    it('a viewer can read but not create; the denial is audited', async () => {
      const bob = tokenFor('bob');
      expect((await req('GET', '/projects', { token: bob })).status).toBe(200);
      const res = await req('POST', '/projects', { token: bob, body: { name: 'New', description: 'd', goal: 'A goal that is long enough' } });
      expect(res.status).toBe(403);
      expect(((await res.json()) as any).message).toBe('Missing permission: project:create');
      const denied = audit.entries.find(e => e.action === 'access.denied' && e.actor.userId === 'bob')!;
      expect(denied).toBeDefined();
      expect(denied.resourceId).toBe('POST /api/projects');
      expect(denied.success).toBe(false);
      expect(projectService.createProject).not.toHaveBeenCalled();
    });

    it('a board member creates a project; the action is audited with the request', async () => {
      const res = await req('POST', '/projects', { token: tokenFor('alice'), body: { name: 'New shop', description: 'd', goal: 'A goal that is long enough' } });
      expect(res.status).toBe(201);
      const entry = audit.entries.find(e => e.action === 'project.create')!;
      expect(entry.actor).toMatchObject({ type: 'user', userId: 'alice', label: 'alice@x.com' });
      expect(entry).toMatchObject({ resourceId: 'p-new', projectId: 'p-new', success: true, ipAddress: expect.any(String) });
      expect((entry.changes as any).request.name).toBe('New shop');
    });

    it('only the owner (or an admin) changes a project, and the change is audited before/after', async () => {
      expect((await req('PATCH', '/projects/p-alice', { token: tokenFor('carol'), body: { budget: 50 } })).status).toBe(403);
      expect(audit.entries.some(e => e.action === 'access.denied' && e.resourceId === 'update Project p-alice')).toBe(true);
      expect(project.budget).toBe(5);

      expect((await req('PATCH', '/projects/p-alice', { token: tokenFor('alice'), body: { budget: 9 } })).status).toBe(200);
      const update = audit.entries.find(e => e.action === 'project.update' && e.success)!;
      expect((update.changes as any).diff).toEqual([{ field: 'budget', from: 5, to: 9 }]);
      expect(update.projectId).toBe('p-alice');

      expect((await req('PATCH', '/projects/p-alice', { token: tokenFor('admin'), body: { budget: 10 } })).status).toBe(200);
    });

    it('a deactivated user is refused even with a valid token', async () => {
      expect((await req('GET', '/projects', { token: tokenFor('dave') })).status).toBe(401);
    });

    it('/auth/me returns the permissions the web app uses', async () => {
      const me: any = await (await req('GET', '/auth/me', { token: tokenFor('bob') })).json();
      expect(me).toMatchObject({ id: 'bob', role: 'viewer', permissions: ['project:read', 'report:view'] });
    });

    it('user management is admin-only and protects the admin from locking themselves out', async () => {
      expect((await req('GET', '/users', { token: tokenFor('alice') })).status).toBe(403);
      expect((await req('GET', '/users', { token: tokenFor('admin') })).status).toBe(200);
      expect((await req('PATCH', '/users/admin/role', { token: tokenFor('admin'), body: { role: 'viewer' } })).status).toBe(409);
      expect((await req('PATCH', '/users/carol/role', { token: tokenFor('admin'), body: { role: 'superuser' } })).status).toBe(400);
      const res = await req('PATCH', '/users/carol/role', { token: tokenFor('admin'), body: { role: 'viewer' } });
      expect(((await res.json()) as any).permissions).toEqual(['project:read', 'report:view']);
      // takes effect on carol's next request
      expect((await req('PATCH', '/projects/p-alice', { token: tokenFor('carol'), body: { budget: 1 } })).status).toBe(403);
      expect(audit.entries.find(e => e.action === 'user.role_change' && e.success)!.actor.userId).toBe('admin');
    });
  });

  describe('Task 21: login auditing and the audit API', () => {
    it('records failed and successful logins with the account as actor', async () => {
      await req('POST', '/auth/login', { body: { email: 'carol@x.com', password: 'wrong' } });
      await req('POST', '/auth/login', { body: { email: 'carol@x.com', password: PASSWORD } });
      const logins = audit.entries.filter(e => e.action === 'auth.login' && (e.actor.label === 'carol@x.com'));
      expect(logins.map(e => e.success)).toEqual([false, true]);
      expect(logins[0].actor.type).toBe('anonymous');
      expect(logins[1].actor).toMatchObject({ type: 'user', userId: 'carol' });
      expect(JSON.stringify(logins[0].changes)).not.toContain('wrong');
    });

    it('rate limits logins per IP and e-mail, which shows up as an anomaly', async () => {
      const statuses: number[] = [];
      for (let i = 0; i < 11; i++) statuses.push((await req('POST', '/auth/login', { body: { email: 'eve@x.com', password: 'guess' } })).status);
      expect(statuses.slice(0, 10).every(s => s === 401)).toBe(true);
      expect(statuses[10]).toBe(429);
      // another account from the same IP is not blocked by eve's window
      expect((await req('POST', '/auth/login', { body: { email: 'alice@x.com', password: PASSWORD } })).status).toBe(201);

      const anomalies: any = await (await req('GET', '/audit/anomalies', { token: tokenFor('admin') })).json();
      expect(anomalies.find((a: any) => a.subject === 'account eve@x.com')).toMatchObject({ rule: 'repeated_failed_login', count: 10, severity: 'critical' });
    });

    it('filters and exports the audit log to admins only', async () => {
      expect((await req('GET', '/audit', { token: tokenFor('alice') })).status).toBe(403);
      const page: any = await (await req('GET', '/audit?action=project.*&pageSize=10', { token: tokenFor('admin') })).json();
      expect(page.items.length).toBeGreaterThan(0);
      expect(page.items.every((e: any) => e.action.startsWith('project.'))).toBe(true);

      const csv = await req('GET', '/audit/export?success=false', { token: tokenFor('admin') });
      expect(csv.headers.get('content-type')).toContain('text/csv');
      expect(csv.headers.get('content-disposition')).toMatch(/attachment; filename="audit-log-\d{4}-\d{2}-\d{2}\.csv"/);
      const bytes = Buffer.from(await csv.arrayBuffer());
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM for Excel
      const text = bytes.toString('utf8');
      expect(text.split('\r\n')[0]).toContain('timestamp,actor_type,actor');
      expect(text).toContain('access.denied');
      expect(text).not.toContain('project.create');
    });
  });

  describe('Task 22: API keys', () => {
    it('are accepted on /api/v1 only', async () => {
      const { token } = await issueKey('alice', [Permission.PROJECT_READ]);
      expect((await req('GET', '/v1/projects', { apiKey: token })).status).toBe(200);
      const res = await req('GET', '/projects', { apiKey: token });
      expect(res.status).toBe(401);
      expect(((await res.json()) as any).message).toMatch(/only accepted on the integration API/);
    });

    it('act with their scopes only, and as their owner', async () => {
      const { token } = await issueKey('alice', [Permission.PROJECT_READ]);
      expect((await req('POST', '/v1/projects', { apiKey: token, body: { name: 'Via key', description: 'd', goal: 'A goal that is long enough' } })).status).toBe(403);

      const writer = await issueKey('alice', [Permission.PROJECT_CREATE]);
      const res = await req('POST', '/v1/projects', { apiKey: writer.token, body: { name: 'Via key', description: 'd', goal: 'A goal that is long enough' } });
      expect(res.status).toBe(201);
      expect(projectService.createProject).toHaveBeenLastCalledWith(expect.objectContaining({ createdById: 'alice' }));
      const entry = audit.entries.filter(e => e.action === 'project.create').pop()!;
      expect(entry.actor).toMatchObject({ type: 'api_key', userId: 'alice', apiKeyId: writer.apiKey.id, label: 'alice@x.com (key test)' });
    });

    it('are refused when wrong, revoked, or their owner was deactivated', async () => {
      const { apiKey, token } = await issueKey('alice', [Permission.PROJECT_READ]);
      expect((await req('GET', '/v1/projects', { apiKey: token.slice(0, -3) + 'abc' })).status).toBe(401);
      expect((await req('GET', '/v1/projects', { apiKey: 'aic_nope' })).status).toBe(401);
      apiKey.revoke();
      await keys.save(apiKey);
      expect((await req('GET', '/v1/projects', { apiKey: token })).status).toBe(401);

      const dave = users.find(u => u.id === 'dave');
      dave.isActive = true;
      const daves = await issueKey('dave', [Permission.PROJECT_READ]);
      dave.isActive = false;
      expect((await req('GET', '/v1/projects', { apiKey: daves.token })).status).toBe(401);
    });

    it('are rate limited per key with X-RateLimit headers and Retry-After', async () => {
      const { token } = await issueKey('alice', [Permission.PROJECT_READ]);
      const responses = [];
      for (let i = 0; i < 6; i++) responses.push(await req('GET', '/v1/projects', { apiKey: token }));
      expect(responses.slice(0, 5).map(r => r.status)).toEqual([200, 200, 200, 200, 200]);
      expect(responses[0].headers.get('x-ratelimit-limit')).toBe('5');
      expect(responses[4].headers.get('x-ratelimit-remaining')).toBe('0');
      expect(responses[5].status).toBe(429);
      expect(Number(responses[5].headers.get('retry-after'))).toBeGreaterThan(0);
      // another key has its own window
      const other = await issueKey('alice', [Permission.PROJECT_READ]);
      expect((await req('GET', '/v1/projects', { apiKey: other.token })).status).toBe(200);
      // users with a JWT are not limited by the API-key default
      for (let i = 0; i < 6; i++) expect((await req('GET', '/v1/projects', { token: tokenFor('alice') })).status).toBe(200);
    });
  });
});

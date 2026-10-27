/**
 * Phase 7 (Task 32): what the production stack relies on: one JWT secret for REST and
 * WebSocket, an environment check that stops a misconfigured production API, and health
 * endpoints a load balancer / Docker can act on.
 */
import * as net from 'net';
import * as jwt from 'jsonwebtoken';
import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { corsOrigins, isProduction, jwtSecret, looksLikePlaceholder, swaggerEnabled } from '../../../src/modules/security/runtime-config';
import { EnvValidator } from '../../../src/modules/security/env-validator';
import { HealthService } from '../../../src/modules/health/health.service';
import { HealthController } from '../../../src/modules/health/health.controller';
import { AppWebSocketGateway } from '../../../src/modules/websocket/websocket.gateway';

const SECRET = 'a'.repeat(40);

describe('runtime config', () => {
  it('uses JWT_SECRET, and one development fallback everywhere when it is unset', () => {
    expect(jwtSecret({ JWT_SECRET: SECRET })).toBe(SECRET);
    expect(jwtSecret({})).toBe(jwtSecret({ JWT_SECRET: '' }));
  });

  it('reads CORS origins as a list, and allows every origin when unset', () => {
    expect(corsOrigins({ CORS_ORIGIN: 'https://a.example, https://b.example' })).toEqual(['https://a.example', 'https://b.example']);
    expect(corsOrigins({})).toBe(true);
  });

  it('keeps Swagger on unless ENABLE_SWAGGER=false', () => {
    expect(swaggerEnabled({})).toBe(true);
    expect(swaggerEnabled({ ENABLE_SWAGGER: 'FALSE' })).toBe(false);
  });

  it('recognises placeholders and production', () => {
    expect(looksLikePlaceholder('CHANGE_ME')).toBe(true);
    expect(looksLikePlaceholder('your_9router_api_key')).toBe(true);
    expect(looksLikePlaceholder(SECRET)).toBe(false);
    expect(isProduction({ NODE_ENV: 'production' })).toBe(true);
    expect(isProduction({ NODE_ENV: 'development' })).toBe(false);
  });
});

describe('EnvValidator', () => {
  const production = {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://aicorp:s3cret-pass@postgres:5432/ai_corp',
    NINE_ROUTER_API_KEY: 'sk-real-key',
    JWT_SECRET: SECRET,
    CORS_ORIGIN: 'https://demo.example',
  };
  let validator: EnvValidator;
  beforeEach(() => {
    validator = new EnvValidator();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });
  afterEach(() => jest.restoreAllMocks());

  it('accepts a complete production environment', () => {
    expect(validator.validate(production)).toMatchObject({ valid: true, errors: [] });
  });

  it('requires JWT_SECRET and CORS_ORIGIN in production only', () => {
    const { JWT_SECRET, CORS_ORIGIN, ...rest } = production;
    expect(validator.validate(rest).missing).toEqual(['JWT_SECRET', 'CORS_ORIGIN']);
    expect(validator.validate({ ...rest, NODE_ENV: 'development' })).toMatchObject({ valid: true, missing: [] });
  });

  it('rejects placeholder values and a short JWT secret in production', () => {
    const result = validator.validate({ ...production, NINE_ROUTER_API_KEY: 'CHANGE_ME', JWT_SECRET: 'short' });
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toContain('placeholder values in NINE_ROUTER_API_KEY');
    expect(result.errors.join(' ')).toContain('at least 32 characters');
  });

  it('only warns about placeholders in development', () => {
    expect(validator.validate({ ...production, NODE_ENV: 'development', NINE_ROUTER_API_KEY: 'CHANGE_ME' }).valid).toBe(true);
  });

  it('stops the boot of a misconfigured production API', () => {
    const saved = { ...process.env };
    try {
      process.env = { ...production, JWT_SECRET: '' } as NodeJS.ProcessEnv;
      expect(() => validator.onModuleInit()).toThrow(/Invalid production environment: missing JWT_SECRET/);
      process.env = { ...production, NODE_ENV: 'development', JWT_SECRET: '' } as NodeJS.ProcessEnv;
      expect(() => validator.onModuleInit()).not.toThrow();
    } finally {
      process.env = saved;
    }
  });
});

describe('WebSocket authentication', () => {
  const client = (token?: string) => ({
    id: 'socket-1',
    handshake: { auth: token ? { token } : {}, headers: {} },
    join: jest.fn(),
    disconnect: jest.fn(),
  });
  beforeEach(() => jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined));
  afterEach(() => jest.restoreAllMocks());

  it('accepts a token signed like the REST login (same secret, also without JWT_SECRET)', () => {
    const saved = process.env.JWT_SECRET;
    delete process.env.JWT_SECRET;
    try {
      const gateway = new AppWebSocketGateway();
      const socket = client(jwt.sign({ sub: 'user-1' }, jwtSecret()));
      gateway.handleConnection(socket as any);
      expect(socket.join).toHaveBeenCalledWith('user_user-1');
      expect(socket.disconnect).not.toHaveBeenCalled();
    } finally {
      if (saved !== undefined) process.env.JWT_SECRET = saved;
    }
  });

  it('refuses approval answers over the socket (only the REST route checks permission, assignee and audit)', () => {
    const gateway = new AppWebSocketGateway();
    const answer = gateway.handleApprovalResponse({ user: { sub: 'viewer-1' } } as any, { approvalId: 'approval-1' });
    expect(answer).toEqual({ status: 'error', message: expect.stringContaining('POST /api/approvals/:id/approve') });
  });

  it('disconnects a token signed with another secret', () => {
    const gateway = new AppWebSocketGateway();
    const socket = client(jwt.sign({ sub: 'user-1' }, 'someone-else'));
    gateway.handleConnection(socket as any);
    expect(socket.disconnect).toHaveBeenCalled();
  });
});

describe('Health', () => {
  const fakeRedis = (reply: string) =>
    new Promise<net.Server>((resolve) => {
      const server = net.createServer((socket) => socket.on('data', () => socket.write(reply)));
      server.listen(0, '127.0.0.1', () => resolve(server));
    });
  const port = (server: net.Server) => (server.address() as net.AddressInfo).port;
  const closedPort = async () => {
    const server = await fakeRedis('');
    const p = port(server);
    await new Promise((r) => server.close(r));
    return p;
  };

  it('pings Redis', async () => {
    const server = await fakeRedis('+PONG\r\n');
    try {
      const check = await new HealthService({} as any).checkRedis('127.0.0.1', port(server));
      expect(check).toMatchObject({ name: 'redis', status: 'healthy' });
    } finally {
      server.close();
    }
  });

  it('reports Redis as degraded when it refuses or answers something else', async () => {
    const server = await fakeRedis('-NOAUTH Authentication required.\r\n');
    try {
      expect(await new HealthService({} as any).checkRedis('127.0.0.1', port(server))).toMatchObject({ status: 'degraded', error: '-NOAUTH Authentication required.' });
    } finally {
      server.close();
    }
    expect((await new HealthService({} as any).checkRedis('127.0.0.1', await closedPort())).status).toBe('degraded');
  });

  describe('status', () => {
    const service = (dbUp: boolean, redisUp: boolean, llmUp: boolean) => {
      const health = new HealthService({ $queryRaw: dbUp ? jest.fn().mockResolvedValue([1]) : jest.fn().mockRejectedValue(new Error('ECONNREFUSED')) } as any);
      jest.spyOn(health, 'checkRedis').mockResolvedValue({ name: 'redis', status: redisUp ? 'healthy' : 'degraded' });
      jest.spyOn(health as any, 'checkLLMGateway').mockResolvedValue({ name: 'ninerouter', status: llmUp ? 'healthy' : 'degraded' });
      return health;
    };
    afterEach(() => jest.restoreAllMocks());

    it('is healthy when everything answers', async () => {
      const result = await service(true, true, true).checkHealth();
      expect(result.status).toBe('healthy');
      expect(result.checks.map((c) => c.name)).toEqual(['database', 'redis', 'ninerouter']);
    });

    it('is degraded without Redis or the LLM gateway', async () => {
      expect((await service(true, false, true).checkHealth()).status).toBe('degraded');
      expect((await service(true, true, false).checkHealth()).status).toBe('degraded');
    });

    it('is unhealthy without the database, and the readiness endpoint answers 503', async () => {
      const health = service(false, true, true);
      expect((await health.checkHealth()).status).toBe('unhealthy');
      const controller = new HealthController(health);
      await expect(controller.getHealth()).rejects.toBeInstanceOf(ServiceUnavailableException);
      await expect(new HealthController(service(true, false, false)).getHealth()).resolves.toMatchObject({ status: 'degraded' });
      expect(controller.live()).toMatchObject({ status: 'ok' });
    });
  });
});

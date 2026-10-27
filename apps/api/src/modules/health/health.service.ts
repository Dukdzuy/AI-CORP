import { Injectable, Logger } from '@nestjs/common';
import { createConnection } from 'net';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async checkHealth(): Promise<HealthCheckResult> {
    const checks: ServiceCheck[] = [];
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

    // Database check
    const dbCheck = await this.checkDatabase();
    checks.push(dbCheck);

    // Without Redis the engine runs nodes directly (no queue, no retries across restarts)
    const redisCheck = await this.checkRedis();
    checks.push(redisCheck);

    // 9Router check
    const llmCheck = await this.checkLLMGateway();
    checks.push(llmCheck);

    // The API cannot serve anything without its database; the others only degrade it
    if (dbCheck.status !== 'healthy') overallStatus = 'unhealthy';
    else if (checks.some((check) => check.status !== 'healthy')) overallStatus = 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      checks,
    };
  }

  private async checkDatabase(): Promise<ServiceCheck> {
    try {
      const start = Date.now();
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        name: 'database',
        status: 'healthy',
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  /** Redis PING over a raw socket, so the check needs no client library */
  checkRedis(host = process.env.REDIS_HOST || 'localhost', port = parseInt(process.env.REDIS_PORT || '6379', 10)): Promise<ServiceCheck> {
    const start = Date.now();
    return new Promise((resolve) => {
      const socket = createConnection({ host, port });
      const finish = (check: ServiceCheck) => {
        socket.destroy();
        resolve(check);
      };
      socket.setTimeout(2000, () => finish({ name: 'redis', status: 'degraded', error: 'Timeout' }));
      socket.on('error', (error) => finish({ name: 'redis', status: 'degraded', error: error.message }));
      socket.on('connect', () => socket.write('PING\r\n'));
      socket.on('data', (data) =>
        finish(
          data.toString().startsWith('+PONG')
            ? { name: 'redis', status: 'healthy', latencyMs: Date.now() - start }
            : { name: 'redis', status: 'degraded', error: data.toString().trim().slice(0, 100) },
        ),
      );
    });
  }

  private async checkLLMGateway(): Promise<ServiceCheck> {
    const gatewayUrl = (process.env.NINE_ROUTER_URL || 'http://localhost:20128').replace(/\/v1\/?$/, '');
    try {
      const start = Date.now();
      const response = await fetch(`${gatewayUrl}/api/health`, {
        signal: AbortSignal.timeout(5000),
      });
      const status = response.ok ? 'healthy' : 'degraded';
      return {
        name: 'ninerouter',
        status,
        latencyMs: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'ninerouter',
        status: 'degraded',
        error: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }
}

export interface ServiceCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptimeSeconds: number;
  checks: ServiceCheck[];
}

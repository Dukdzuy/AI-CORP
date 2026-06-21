import { Injectable, Logger } from '@nestjs/common';
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
    if (dbCheck.status !== 'healthy') overallStatus = 'degraded';

    // 9Router check
    const llmCheck = await this.checkLLMGateway();
    checks.push(llmCheck);
    if (llmCheck.status === 'unhealthy') overallStatus = 'unhealthy';
    if (llmCheck.status === 'degraded' && overallStatus === 'healthy') overallStatus = 'degraded';

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
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

interface ServiceCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latencyMs?: number;
  error?: string;
}

export interface HealthCheckResult {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  checks: ServiceCheck[];
}

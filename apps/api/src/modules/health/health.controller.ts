import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../access/access.decorators';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  /** Readiness: 503 (same body) when the database is down, so a load balancer stops routing here */
  @Public()
  @Get()
  async getHealth() {
    const result = await this.healthService.checkHealth();
    if (result.status === 'unhealthy') throw new ServiceUnavailableException(result);
    return result;
  }

  /** Liveness: the process answers; no dependency is checked */
  @Public()
  @Get('live')
  live() {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }
}

import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { Public } from '../access/access.decorators';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Public()
  @Get()
  async getHealth() {
    return this.healthService.checkHealth();
  }
}

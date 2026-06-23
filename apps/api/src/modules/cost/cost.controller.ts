import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { CostService } from './cost.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cost')
export class CostController {
  constructor(private readonly costService: CostService) {}

  @Get('summary')
  async getSummary(@Query('projectId') projectId?: string) {
    return this.costService.getSummary(projectId);
  }
}

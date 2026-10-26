import { Controller, Get, Query } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { RequirePermission } from '../access/access.decorators';
import { CostService } from './cost.service';

@RequirePermission(Permission.REPORT_VIEW)
@Controller('cost')
export class CostController {
  constructor(private readonly costService: CostService) {}

  @Get('summary')
  async getSummary(@Query('projectId') projectId?: string) {
    return this.costService.getSummary(projectId);
  }
}

import { Controller, Get, Param } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { RequirePermission } from '../access/access.decorators';
import { ProjectEstimationService } from './project-estimation.service';

/**
 * Effort and cost forecasts (Phase 6, Task 25).
 */
@Controller()
export class EstimationController {
  constructor(private readonly estimation: ProjectEstimationService) {}

  /** Current forecast, stored forecasts, actual work so far and the comparison */
  @Get('projects/:id/estimate')
  @RequirePermission(Permission.REPORT_VIEW)
  project(@Param('id') id: string) {
    return this.estimation.projectEstimate(id);
  }

  /** The model per role, its leave-one-out error, and the accuracy on finished projects */
  @Get('analytics/estimation')
  @RequirePermission(Permission.REPORT_VIEW)
  model() {
    return this.estimation.modelView();
  }
}

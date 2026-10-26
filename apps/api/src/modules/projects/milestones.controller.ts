import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { RequirePermission } from '../access/access.decorators';
import { Audited } from '../audit/audit.decorators';
import { MilestoneApplicationService } from './milestone-application.service';
import { CreateMilestoneDto, UpdateMilestoneDto } from './projects.dto';

@Controller()
export class MilestonesController {
  constructor(private readonly milestoneService: MilestoneApplicationService) {}

  @Post('projects/:projectId/milestones')
  @RequirePermission(Permission.TASK_MANAGE)
  @Audited({ action: 'milestone.create', resourceType: 'Milestone', projectIdParam: 'projectId' })
  async createMilestone(
    @Param('projectId') projectId: string,
    @Body() data: CreateMilestoneDto
  ) {
    return this.milestoneService.createMilestone(projectId, data);
  }

  @Get('projects/:projectId/milestones')
  @RequirePermission(Permission.PROJECT_READ)
  async getMilestones(@Param('projectId') projectId: string) {
    return this.milestoneService.getMilestones(projectId);
  }

  @Patch('milestones/:id')
  @RequirePermission(Permission.TASK_MANAGE)
  @Audited({ action: 'milestone.update', resourceType: 'Milestone', idParam: 'id' })
  async updateMilestone(
    @Param('id') id: string,
    @Body() data: UpdateMilestoneDto
  ) {
    return this.milestoneService.updateMilestone(id, data);
  }
}

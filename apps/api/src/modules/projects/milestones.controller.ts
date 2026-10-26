import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { MilestoneApplicationService } from './milestone-application.service';
import { CreateMilestoneDto, UpdateMilestoneDto } from './projects.dto';

@Controller()
export class MilestonesController {
  constructor(private readonly milestoneService: MilestoneApplicationService) {}

  @Post('projects/:projectId/milestones')
  async createMilestone(
    @Param('projectId') projectId: string,
    @Body() data: CreateMilestoneDto
  ) {
    return this.milestoneService.createMilestone(projectId, data);
  }

  @Get('projects/:projectId/milestones')
  async getMilestones(@Param('projectId') projectId: string) {
    return this.milestoneService.getMilestones(projectId);
  }

  @Patch('milestones/:id')
  async updateMilestone(
    @Param('id') id: string,
    @Body() data: UpdateMilestoneDto
  ) {
    return this.milestoneService.updateMilestone(id, data);
  }
}

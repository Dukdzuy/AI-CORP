import { Controller, Get, Post, Patch, Body, Param } from '@nestjs/common';
import { MilestonesService, CreateMilestoneDto, UpdateMilestoneDto } from './milestones.service';

@Controller()
export class MilestonesController {
  constructor(private readonly milestonesService: MilestonesService) {}

  @Post('projects/:projectId/milestones')
  async createMilestone(
    @Param('projectId') projectId: string,
    @Body() data: CreateMilestoneDto
  ) {
    return this.milestonesService.createMilestone(projectId, data);
  }

  @Get('projects/:projectId/milestones')
  async getMilestones(@Param('projectId') projectId: string) {
    return this.milestonesService.getMilestones(projectId);
  }

  @Patch('milestones/:id')
  async updateMilestone(
    @Param('id') id: string,
    @Body() data: UpdateMilestoneDto
  ) {
    return this.milestonesService.updateMilestone(id, data);
  }
}

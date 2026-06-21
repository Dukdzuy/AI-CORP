import { Controller, Get, Post, Patch, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ProjectsService, CreateProjectDto, UpdateProjectDto } from './projects.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Get()
  async listProjects() {
    return this.projectsService.listProjects();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createProject(@Body() data: CreateProjectDto, @Req() req: any) {
    return this.projectsService.createProject({ ...data, createdById: req.user.id });
  }

  @Get(':id')
  async getProject(@Param('id') id: string) {
    return this.projectsService.getProjectDetails(id);
  }

  @Patch(':id')
  async updateProject(@Param('id') id: string, @Body() data: UpdateProjectDto) {
    return this.projectsService.updateProject(id, data);
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, Req, UseGuards } from '@nestjs/common';
import { ProjectApplicationService } from './project-application.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectService: ProjectApplicationService) {}

  @Get()
  async listProjects() {
    return this.projectService.listProjects();
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async createProject(@Body() data: CreateProjectDto, @Req() req: any) {
    return this.projectService.createProject({ ...data, createdById: req.user.id });
  }

  @Get(':id')
  async getProject(@Param('id') id: string) {
    return this.projectService.getProjectDetails(id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async updateProject(@Param('id') id: string, @Body() data: UpdateProjectDto) {
    return this.projectService.updateProject(id, data);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async deleteProject(@Param('id') id: string) {
    return this.projectService.deleteProject(id);
  }
}

import { Controller, Get, Post, Patch, Delete, Body, Param, Req } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { Principal } from '../../domain/security';
import { CurrentPrincipal, RequirePermission } from '../access/access.decorators';
import { AuthorizationService } from '../access/authorization.service';
import { Audited } from '../audit/audit.decorators';
import { ProjectApplicationService } from './project-application.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly projectService: ProjectApplicationService,
    private readonly authorization: AuthorizationService
  ) {}

  @Get()
  @RequirePermission(Permission.PROJECT_READ)
  async listProjects() {
    return this.projectService.listProjects();
  }

  @Post()
  @RequirePermission(Permission.PROJECT_CREATE)
  @Audited({ action: 'project.create', resourceType: 'Project' })
  async createProject(@Body() data: CreateProjectDto, @Req() req: any) {
    return this.projectService.createProject({ ...data, createdById: req.user.id });
  }

  @Get(':id')
  @RequirePermission(Permission.PROJECT_READ)
  async getProject(@Param('id') id: string) {
    return this.projectService.getProjectDetails(id);
  }

  @Patch(':id')
  @RequirePermission(Permission.PROJECT_UPDATE)
  @Audited({ action: 'project.update', resourceType: 'Project', idParam: 'id' })
  async updateProject(@Param('id') id: string, @Body() data: UpdateProjectDto, @CurrentPrincipal() principal: Principal, @Req() req: any) {
    await this.authorization.assertProjectOwner(principal, id, 'update', req);
    return this.projectService.updateProject(id, data);
  }

  @Delete(':id')
  @RequirePermission(Permission.PROJECT_DELETE)
  @Audited({ action: 'project.delete', resourceType: 'Project', idParam: 'id' })
  async deleteProject(@Param('id') id: string, @CurrentPrincipal() principal: Principal, @Req() req: any) {
    await this.authorization.assertProjectOwner(principal, id, 'delete', req);
    return this.projectService.deleteProject(id);
  }
}

import { Controller, Get, Post, Patch, Body, Param, Query, Req } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { Principal } from '../../domain/security';
import { CurrentPrincipal, RequirePermission } from '../access/access.decorators';
import { AuthorizationService } from '../access/authorization.service';
import { Audited } from '../audit/audit.decorators';
import { TaskApplicationService } from './task-application.service';
import { CreateTaskDto, UpdateTaskDto } from './projects.dto';

/**
 * Tasks are changed by the owner of their project or an admin, like the project itself.
 */
@Controller()
export class TasksController {
  constructor(
    private readonly taskService: TaskApplicationService,
    private readonly authorization: AuthorizationService
  ) {}

  @Get('tasks')
  @RequirePermission(Permission.PROJECT_READ)
  async listTasks(@Query('projectId') projectId?: string) {
    return this.taskService.listTasks(projectId);
  }

  @Post('projects/:projectId/tasks')
  @RequirePermission(Permission.TASK_MANAGE)
  @Audited({ action: 'task.create', resourceType: 'Task', projectIdParam: 'projectId' })
  async createTask(
    @Param('projectId') projectId: string,
    @Body() data: CreateTaskDto,
    @CurrentPrincipal() principal: Principal,
    @Req() req: any
  ) {
    // 404 for a project that does not exist, 403 for someone else's
    await this.authorization.assertProjectOwner(principal, projectId, 'add tasks to', req);
    return this.taskService.createTask(projectId, data);
  }

  @Patch('tasks/:id')
  @RequirePermission(Permission.TASK_MANAGE)
  @Audited({ action: 'task.update', resourceType: 'Task', idParam: 'id' })
  async updateTask(
    @Param('id') id: string,
    @Body() data: UpdateTaskDto,
    @CurrentPrincipal() principal: Principal,
    @Req() req: any
  ) {
    const projectId = await this.taskService.projectIdOf(id);
    await this.authorization.assertProjectOwner(principal, projectId, 'change tasks of', req);
    return this.taskService.updateTask(id, data);
  }
}

import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { RequirePermission } from '../access/access.decorators';
import { Audited } from '../audit/audit.decorators';
import { TaskApplicationService } from './task-application.service';
import { CreateTaskDto, UpdateTaskDto } from './projects.dto';

@Controller()
export class TasksController {
  constructor(private readonly taskService: TaskApplicationService) {}

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
    @Body() data: CreateTaskDto
  ) {
    return this.taskService.createTask(projectId, data);
  }

  @Patch('tasks/:id')
  @RequirePermission(Permission.TASK_MANAGE)
  @Audited({ action: 'task.update', resourceType: 'Task', idParam: 'id' })
  async updateTask(
    @Param('id') id: string,
    @Body() data: UpdateTaskDto
  ) {
    return this.taskService.updateTask(id, data);
  }
}

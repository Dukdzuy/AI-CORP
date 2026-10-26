import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { TaskApplicationService } from './task-application.service';
import { CreateTaskDto, UpdateTaskDto } from './projects.dto';

@Controller()
export class TasksController {
  constructor(private readonly taskService: TaskApplicationService) {}

  @Get('tasks')
  async listTasks(@Query('projectId') projectId?: string) {
    return this.taskService.listTasks(projectId);
  }

  @Post('projects/:projectId/tasks')
  async createTask(
    @Param('projectId') projectId: string,
    @Body() data: CreateTaskDto
  ) {
    return this.taskService.createTask(projectId, data);
  }

  @Patch('tasks/:id')
  async updateTask(
    @Param('id') id: string,
    @Body() data: UpdateTaskDto
  ) {
    return this.taskService.updateTask(id, data);
  }
}

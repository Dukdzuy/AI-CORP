import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { TasksService, CreateTaskDto, UpdateTaskDto } from './tasks.service';

@Controller()
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get('tasks')
  async listTasks(@Query('projectId') projectId?: string) {
    return this.tasksService.listTasks(projectId);
  }

  @Post('projects/:projectId/tasks')
  async createTask(
    @Param('projectId') projectId: string,
    @Body() data: CreateTaskDto
  ) {
    return this.tasksService.createTask(projectId, data);
  }

  @Patch('tasks/:id')
  async updateTask(
    @Param('id') id: string,
    @Body() data: UpdateTaskDto
  ) {
    return this.tasksService.updateTask(id, data);
  }
}

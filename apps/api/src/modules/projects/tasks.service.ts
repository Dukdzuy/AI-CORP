import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { WebSocketEventType } from '@ai-corp/shared-types';

export interface CreateTaskDto {
  title: string;
  description: string;
  priority?: string;
  assignedAgent?: string;
  milestoneId?: string;
}

export interface UpdateTaskDto {
  status?: string;
  title?: string;
  description?: string;
  priority?: string;
  assignedAgent?: string;
}

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);
  
  // Valid transitions: todo -> in_progress -> review -> done
  private readonly validTransitions: Record<string, string[]> = {
    todo: ['in_progress', 'done'],
    in_progress: ['review', 'todo'], // Can move back to todo
    review: ['done', 'in_progress'], // Can fail review and go back
    done: ['in_progress'], // Can be reopened
  };

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: AppWebSocketGateway,
  ) {}

  async listTasks(projectId?: string) {
    const where = projectId ? { projectId } : {};
    return this.prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTask(projectId: string, data: CreateTaskDto) {
    const task = await this.prisma.task.create({
      data: {
        projectId,
        title: data.title,
        description: data.description,
        status: 'todo',
        priority: data.priority || 'medium',
        assignedAgent: data.assignedAgent,
        milestoneId: data.milestoneId,
      },
    });

    this.logger.log(`Created task ${task.id} for project ${projectId}`);
    this.emitTaskUpdated(task);
    return task;
  }

  async updateTask(id: string, data: UpdateTaskDto) {
    const existingTask = await this.prisma.task.findUnique({ where: { id } });
    if (!existingTask) {
      throw new NotFoundException(`Task with ID ${id} not found.`);
    }

    if (data.status && data.status !== existingTask.status) {
      const allowedNext = this.validTransitions[existingTask.status] || [];
      if (!allowedNext.includes(data.status)) {
        throw new BadRequestException(`Invalid status transition from ${existingTask.status} to ${data.status}`);
      }
    }

    const task = await this.prisma.task.update({
      where: { id },
      data,
    });

    this.logger.log(`Updated task ${id}`);
    this.emitTaskUpdated(task);
    return task;
  }

  private emitTaskUpdated(task: any) {
    this.websocketGateway.sendToProject(task.projectId, {
      type: WebSocketEventType.TASK_UPDATED,
      data: task,
      timestamp: new Date()
    } as any);
  }
}

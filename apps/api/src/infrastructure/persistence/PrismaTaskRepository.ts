import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ITaskRepository,
  TaskDTO,
  CreateTaskData,
  UpdateTaskData,
} from '../../domain/repositories';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Prisma implementation of ITaskRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaTaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TaskDTO | null> {
    const task = await this.prisma.task.findUnique({ where: { id } });
    if (!task) return null;
    return this.mapToDTO(task);
  }

  async findByProjectId(projectId: string): Promise<TaskDTO[]> {
    const tasks = await this.prisma.task.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return tasks.map((t) => this.mapToDTO(t));
  }

  async findByStatus(projectId: string, status: string): Promise<TaskDTO[]> {
    const tasks = await this.prisma.task.findMany({
      where: { projectId, status },
      orderBy: { createdAt: 'desc' },
    });
    return tasks.map((t) => this.mapToDTO(t));
  }

  async create(data: CreateTaskData): Promise<TaskDTO> {
    const task = await this.prisma.task.create({
      data: {
        projectId: data.projectId,
        milestoneId: data.milestoneId,
        title: data.title,
        description: data.description,
        status: data.status || 'todo',
        priority: data.priority || 'medium',
        assignedAgent: data.assignedAgent,
        estimatedCost: data.estimatedCost,
      },
    });
    return this.mapToDTO(task);
  }

  async update(id: string, data: UpdateTaskData): Promise<TaskDTO> {
    const task = await this.prisma.task.update({
      where: { id },
      data,
    });
    return this.mapToDTO(task);
  }

  async delete(id: string): Promise<void> {
    // Delete related workflow steps first
    await this.prisma.workflowStep.deleteMany({ where: { taskId: id } });
    await this.prisma.task.delete({ where: { id } });
  }

  async updateStatus(id: string, status: string): Promise<TaskDTO> {
    return this.update(id, { status });
  }

  async updateCost(id: string, amount: number): Promise<TaskDTO> {
    const task = await this.findById(id);
    if (!task) {
      throw new NotFoundException(`Task with ID ${id} not found`);
    }
    const newCost = Number(task.actualCost) + amount;
    return this.update(id, { actualCost: newCost });
  }

  private mapToDTO(task: any): TaskDTO {
    return {
      id: task.id,
      projectId: task.projectId,
      milestoneId: task.milestoneId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedAgent: task.assignedAgent,
      estimatedCost: task.estimatedCost ? Number(task.estimatedCost) : null,
      actualCost: Number(task.actualCost),
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}

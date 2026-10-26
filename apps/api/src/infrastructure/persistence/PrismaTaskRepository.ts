import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ITaskRepository,
  TaskDTO,
  CreateTaskData,
  UpdateTaskData,
} from '../../domain/repositories';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  EntityNotFoundException,
  RepositoryException,
  ForeignKeyViolationException,
  DatabaseConnectionException,
  UniqueConstraintViolationException,
} from '../../domain/exceptions';

/**
 * Prisma implementation of ITaskRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaTaskRepository implements ITaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<TaskDTO | null> {
    try {
      const task = await this.prisma.task.findUnique({ where: { id } });
      if (!task) return null;
      return this.mapToDTO(task);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findById', 'Task', error as Error);
    }
  }

  async findAll(): Promise<TaskDTO[]> {
    try {
      const tasks = await this.prisma.task.findMany({
        orderBy: { createdAt: 'desc' },
      });
      return tasks.map((t) => this.mapToDTO(t));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findAll', 'Task', error as Error);
    }
  }

  async findByProjectId(projectId: string): Promise<TaskDTO[]> {
    try {
      const tasks = await this.prisma.task.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      return tasks.map((t) => this.mapToDTO(t));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findByProjectId', 'Task', error as Error);
    }
  }

  async findByStatus(projectId: string, status: string): Promise<TaskDTO[]> {
    try {
      const tasks = await this.prisma.task.findMany({
        where: { projectId, status },
        orderBy: { createdAt: 'desc' },
      });
      return tasks.map((t) => this.mapToDTO(t));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findByStatus', 'Task', error as Error);
    }
  }

  async create(data: CreateTaskData): Promise<TaskDTO> {
    try {
      const task = await this.prisma.task.create({
        data: {
          id: data.id,
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('Task', 'Project or Milestone');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('create', 'Task', error as Error);
    }
  }

  async update(id: string, data: UpdateTaskData): Promise<TaskDTO> {
    try {
      const task = await this.prisma.task.update({
        where: { id },
        data,
      });
      return this.mapToDTO(task);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('Task', id);
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('update', 'Task', error as Error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Delete related workflow steps first
      await this.prisma.workflowStep.deleteMany({ where: { taskId: id } });
      await this.prisma.task.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('Task', id);
        }
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('Task', 'WorkflowStep');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('delete', 'Task', error as Error);
    }
  }

  async updateStatus(id: string, status: string): Promise<TaskDTO> {
    return this.update(id, { status });
  }

  async updateCost(id: string, amount: number): Promise<TaskDTO> {
    try {
      const task = await this.findById(id);
      if (!task) {
        throw new EntityNotFoundException('Task', id);
      }
      const newCost = Number(task.actualCost) + amount;
      return this.update(id, { actualCost: newCost });
    } catch (error) {
      if (error instanceof EntityNotFoundException) {
        throw error;
      }
      throw new RepositoryException('updateCost', 'Task', error as Error);
    }
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

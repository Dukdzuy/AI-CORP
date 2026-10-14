import { Injectable } from '@nestjs/common';
import {
  IMilestoneRepository,
  MilestoneDTO,
  CreateMilestoneData,
  UpdateMilestoneData,
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
 * Prisma implementation of IMilestoneRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaMilestoneRepository implements IMilestoneRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<MilestoneDTO | null> {
    try {
      const milestone = await this.prisma.milestone.findUnique({ where: { id } });
      if (!milestone) return null;
      return this.mapToDTO(milestone);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findById', 'Milestone', error as Error);
    }
  }

  async findByProjectId(projectId: string): Promise<MilestoneDTO[]> {
    try {
      const milestones = await this.prisma.milestone.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
      });
      return milestones.map((m) => this.mapToDTO(m));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findByProjectId', 'Milestone', error as Error);
    }
  }

  async findByStatus(projectId: string, status: string): Promise<MilestoneDTO[]> {
    try {
      const milestones = await this.prisma.milestone.findMany({
        where: { projectId, status },
        orderBy: { createdAt: 'desc' },
      });
      return milestones.map((m) => this.mapToDTO(m));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findByStatus', 'Milestone', error as Error);
    }
  }

  async create(data: CreateMilestoneData): Promise<MilestoneDTO> {
    try {
      const milestone = await this.prisma.milestone.create({
        data: {
          projectId: data.projectId,
          name: data.name,
          description: data.description,
          status: data.status || 'pending',
          dueDate: data.dueDate,
        },
      });
      return this.mapToDTO(milestone);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new UniqueConstraintViolationException('Milestone', 'name');
        }
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('Milestone', 'Project');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('create', 'Milestone', error as Error);
    }
  }

  async update(id: string, data: UpdateMilestoneData): Promise<MilestoneDTO> {
    try {
      const milestone = await this.prisma.milestone.update({
        where: { id },
        data,
      });
      return this.mapToDTO(milestone);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('Milestone', id);
        }
        if (error.code === 'P2002') {
          throw new UniqueConstraintViolationException('Milestone', 'name');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('update', 'Milestone', error as Error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Update tasks to remove milestone association
      await this.prisma.task.updateMany({
        where: { milestoneId: id },
        data: { milestoneId: null },
      });
      await this.prisma.milestone.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('Milestone', id);
        }
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('Milestone', 'Task');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('delete', 'Milestone', error as Error);
    }
  }

  private mapToDTO(milestone: any): MilestoneDTO {
    return {
      id: milestone.id,
      projectId: milestone.projectId,
      name: milestone.name,
      description: milestone.description,
      status: milestone.status,
      dueDate: milestone.dueDate,
      createdAt: milestone.createdAt,
      updatedAt: milestone.updatedAt,
    };
  }
}

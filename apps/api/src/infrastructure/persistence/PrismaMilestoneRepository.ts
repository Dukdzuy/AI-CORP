import { Injectable } from '@nestjs/common';
import {
  IMilestoneRepository,
  MilestoneDTO,
  CreateMilestoneData,
  UpdateMilestoneData,
} from '../../domain/repositories';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Prisma implementation of IMilestoneRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaMilestoneRepository implements IMilestoneRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<MilestoneDTO | null> {
    const milestone = await this.prisma.milestone.findUnique({ where: { id } });
    if (!milestone) return null;
    return this.mapToDTO(milestone);
  }

  async findByProjectId(projectId: string): Promise<MilestoneDTO[]> {
    const milestones = await this.prisma.milestone.findMany({
      where: { projectId },
      orderBy: { createdAt: 'desc' },
    });
    return milestones.map((m) => this.mapToDTO(m));
  }

  async findByStatus(projectId: string, status: string): Promise<MilestoneDTO[]> {
    const milestones = await this.prisma.milestone.findMany({
      where: { projectId, status },
      orderBy: { createdAt: 'desc' },
    });
    return milestones.map((m) => this.mapToDTO(m));
  }

  async create(data: CreateMilestoneData): Promise<MilestoneDTO> {
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
  }

  async update(id: string, data: UpdateMilestoneData): Promise<MilestoneDTO> {
    const milestone = await this.prisma.milestone.update({
      where: { id },
      data,
    });
    return this.mapToDTO(milestone);
  }

  async delete(id: string): Promise<void> {
    // Update tasks to remove milestone association
    await this.prisma.task.updateMany({
      where: { milestoneId: id },
      data: { milestoneId: null },
    });
    await this.prisma.milestone.delete({ where: { id } });
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

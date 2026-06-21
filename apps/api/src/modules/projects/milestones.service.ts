import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateMilestoneDto {
  name: string;
  description: string;
  dueDate?: Date;
}

export interface UpdateMilestoneDto {
  status?: string;
  name?: string;
  description?: string;
  dueDate?: Date;
}

@Injectable()
export class MilestonesService {
  private readonly logger = new Logger(MilestonesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createMilestone(projectId: string, data: CreateMilestoneDto) {
    const milestone = await this.prisma.milestone.create({
      data: {
        projectId,
        name: data.name,
        description: data.description,
        dueDate: data.dueDate,
        status: 'pending',
      },
    });

    this.logger.log(`Created milestone ${milestone.id} for project ${projectId}`);
    return milestone;
  }

  async getMilestones(projectId: string) {
    return this.prisma.milestone.findMany({
      where: { projectId },
      include: {
        tasks: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });
  }

  async updateMilestone(id: string, data: UpdateMilestoneDto) {
    const existing = await this.prisma.milestone.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException(`Milestone with ID ${id} not found.`);
    }

    const milestone = await this.prisma.milestone.update({
      where: { id },
      data,
    });

    this.logger.log(`Updated milestone ${id}`);
    return milestone;
  }
}

import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import {
  IProjectRepository,
  ProjectDTO,
  CreateProjectData,
  UpdateProjectData,
  MilestoneDTO,
  TaskDTO,
  WorkflowRunDTO,
} from '../../domain/repositories';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Prisma implementation of IProjectRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaProjectRepository implements IProjectRepository {
  private readonly logger = new Logger(PrismaProjectRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProjectDTO | null> {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) return null;
    return this.mapToDTO(project);
  }

  async findAll(options?: {
    orderBy?: 'createdAt' | 'updatedAt';
    order?: 'asc' | 'desc';
  }): Promise<ProjectDTO[]> {
    const projects = await this.prisma.project.findMany({
      orderBy: { [options?.orderBy || 'createdAt']: options?.order || 'desc' },
      include: {
        _count: { select: { tasks: true, milestones: true } },
        workflowRuns: {
          orderBy: { startedAt: 'desc' },
          take: 1,
        },
      },
    });
    return projects.map((p) => this.mapToDTO(p));
  }

  async findByUserId(userId: string): Promise<ProjectDTO[]> {
    const projects = await this.prisma.project.findMany({
      where: { createdById: userId },
      orderBy: { createdAt: 'desc' },
    });
    return projects.map((p) => this.mapToDTO(p));
  }

  async create(data: CreateProjectData): Promise<ProjectDTO> {
    const project = await this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        goal: data.goal,
        budget: data.budget,
        createdById: data.createdById,
      },
    });
    this.logger.log(`Created project ${project.id}`);
    
    // Task 10: Publish ProjectCreatedEvent
    const { DomainEvents } = require('../../domain/events/DomainEvents');
    const { ProjectCreatedEvent } = require('../../domain/events/ProjectCreatedEvent');
    DomainEvents.raise(new ProjectCreatedEvent(
      project.id,
      project.name,
      project.createdById,
      project.budget ? Number(project.budget) : undefined
    ));
    
    return this.mapToDTO(project);
  }

  async update(id: string, data: UpdateProjectData): Promise<ProjectDTO> {
    const project = await this.prisma.project.update({
      where: { id },
      data,
    });
    this.logger.log(`Updated project ${id}`);
    return this.mapToDTO(project);
  }

  async delete(id: string): Promise<void> {
    // Delete related records first (referential integrity)
    await this.prisma.workflowStep.deleteMany({
      where: { workflowRun: { projectId: id } },
    });
    await this.prisma.approval.deleteMany({
      where: { workflowRun: { projectId: id } },
    });
    await this.prisma.workflowRun.deleteMany({ where: { projectId: id } });
    await this.prisma.task.deleteMany({ where: { projectId: id } });
    await this.prisma.milestone.deleteMany({ where: { projectId: id } });
    await this.prisma.agentMessage.deleteMany({ where: { projectId: id } });
    await this.prisma.apiUsageLog.deleteMany({ where: { projectId: id } });
    await this.prisma.project.delete({ where: { id } });
    this.logger.log(`Deleted project ${id}`);
  }

  async updateCost(id: string, amount: number): Promise<ProjectDTO> {
    const project = await this.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found`);
    }

    const newCostAccrued = Number(project.costAccrued) + amount;

    // Check if budget is set and exceeded
    if (project.budget) {
      const budgetLimit = Number(project.budget);

      // Auto-pause if budget exceeded
      if (newCostAccrued >= budgetLimit) {
        this.logger.warn(
          `Project ${id} exceeded budget: ${newCostAccrued} >= ${budgetLimit}. Auto-pausing.`
        );
        return this.update(id, { costAccrued: newCostAccrued, status: 'paused' });
      }

      // Warn if approaching budget (90% threshold)
      if (
        newCostAccrued >= budgetLimit * 0.9 &&
        Number(project.costAccrued) < budgetLimit * 0.9
      ) {
        this.logger.warn(
          `Project ${id} approaching budget limit: ${newCostAccrued} >= ${budgetLimit * 0.9} (90%)`
        );
      }
    }

    return this.update(id, { costAccrued: newCostAccrued });
  }

  async findWithMilestones(
    id: string
  ): Promise<(ProjectDTO & { milestones: MilestoneDTO[] }) | null> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { milestones: true },
    });
    if (!project) return null;

    return {
      ...this.mapToDTO(project),
      milestones: project.milestones.map((m) => ({
        id: m.id,
        projectId: m.projectId,
        name: m.name,
        description: m.description,
        status: m.status,
        dueDate: m.dueDate,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    };
  }

  async findWithTasks(id: string): Promise<(ProjectDTO & { tasks: TaskDTO[] }) | null> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: { tasks: true },
    });
    if (!project) return null;

    return {
      ...this.mapToDTO(project),
      tasks: project.tasks.map((t) => ({
        id: t.id,
        projectId: t.projectId,
        milestoneId: t.milestoneId,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assignedAgent: t.assignedAgent,
        estimatedCost: t.estimatedCost ? Number(t.estimatedCost) : null,
        actualCost: Number(t.actualCost),
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      })),
    };
  }

  async findWithWorkflowRuns(
    id: string,
    limit?: number
  ): Promise<(ProjectDTO & { workflowRuns: WorkflowRunDTO[] }) | null> {
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        workflowRuns: {
          orderBy: { startedAt: 'desc' },
          take: limit || 10,
        },
      },
    });
    if (!project) return null;

    return {
      ...this.mapToDTO(project),
      workflowRuns: project.workflowRuns.map((w) => ({
        id: w.id,
        projectId: w.projectId,
        workflowDefId: w.workflowDefId,
        status: w.status,
        currentNodeId: w.currentNodeId,
        context: w.context,
        startedAt: w.startedAt,
        completedAt: w.completedAt,
      })),
    };
  }

  private mapToDTO(project: any): ProjectDTO {
    return {
      id: project.id,
      name: project.name,
      description: project.description,
      goal: project.goal,
      status: project.status,
      budget: project.budget ? Number(project.budget) : null,
      costAccrued: Number(project.costAccrued),
      createdById: project.createdById,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}

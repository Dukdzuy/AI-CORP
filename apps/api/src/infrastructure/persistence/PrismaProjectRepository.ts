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
import { Prisma } from '@prisma/client';
import {
  EntityNotFoundException,
  RepositoryException,
  ForeignKeyViolationException,
  DatabaseConnectionException,
  UniqueConstraintViolationException,
} from '../../domain/exceptions';

/** Project columns that make up a ProjectDTO (see mapToDTO) */
const DTO_COLUMNS = {
  id: true, name: true, description: true, goal: true, status: true, budget: true,
  costAccrued: true, createdById: true, createdAt: true, updatedAt: true,
} satisfies Prisma.ProjectSelect;

/**
 * Prisma implementation of IProjectRepository
 * Infrastructure layer - depends on domain interfaces
 * Persistence only: domain events are raised by ProjectApplicationService
 */

@Injectable()
export class PrismaProjectRepository implements IProjectRepository {
  private readonly logger = new Logger(PrismaProjectRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ProjectDTO | null> {
    try {
      const project = await this.prisma.project.findUnique({ where: { id } });
      if (!project) return null;
      return this.mapToDTO(project);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findById', 'Project', error as Error);
    }
  }

  async findAll(options?: {
    orderBy?: 'createdAt' | 'updatedAt';
    order?: 'asc' | 'desc';
  }): Promise<ProjectDTO[]> {
    try {
      const projects = await this.prisma.project.findMany({
        // Only the columns mapToDTO returns: the latest run's context JSON and the project's
        // ooadMetadata were loaded and dropped for every project (found by the Phase 6 load test)
        orderBy: { [options?.orderBy || 'createdAt']: options?.order || 'desc' },
        select: {
          ...DTO_COLUMNS,
          // The latest run's state only (no context JSON), for the progress shown on project cards
          workflowRuns: {
            where: { parentRunId: null },
            orderBy: { startedAt: 'desc' },
            take: 1,
            select: { id: true, status: true, currentNodeId: true, workflowDefId: true, workflowDefVersion: true },
          },
        },
      });
      return projects.map((p) => ({ ...this.mapToDTO(p), latestRun: p.workflowRuns[0] ?? null }));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findAll', 'Project', error as Error);
    }
  }

  async findByUserId(userId: string): Promise<ProjectDTO[]> {
    try {
      const projects = await this.prisma.project.findMany({
        where: { createdById: userId },
        orderBy: { createdAt: 'desc' },
      });
      return projects.map((p) => this.mapToDTO(p));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findByUserId', 'Project', error as Error);
    }
  }

  async create(data: CreateProjectData): Promise<ProjectDTO> {
    try {
      const project = await this.prisma.project.create({
        data: {
          id: data.id,
          name: data.name,
          description: data.description,
          goal: data.goal,
          budget: data.budget,
          createdById: data.createdById,
        },
      });
      this.logger.log(`Created project ${project.id}`);
      return this.mapToDTO(project);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new UniqueConstraintViolationException('Project', 'name');
        }
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('Project', 'User');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('create', 'Project', error as Error);
    }
  }

  async update(id: string, data: UpdateProjectData): Promise<ProjectDTO> {
    try {
      const project = await this.prisma.project.update({
        where: { id },
        data,
      });
      this.logger.log(`Updated project ${id}`);
      return this.mapToDTO(project);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('Project', id);
        }
        if (error.code === 'P2002') {
          throw new UniqueConstraintViolationException('Project', 'name');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('update', 'Project', error as Error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Delete related records first (referential integrity), all or nothing
      await this.prisma.$transaction([
        this.prisma.workflowStep.deleteMany({ where: { workflowRun: { projectId: id } } }),
        this.prisma.approval.deleteMany({ where: { workflowRun: { projectId: id } } }),
        this.prisma.workflowRun.deleteMany({ where: { projectId: id } }),
        this.prisma.task.deleteMany({ where: { projectId: id } }),
        this.prisma.milestone.deleteMany({ where: { projectId: id } }),
        this.prisma.agentMessage.deleteMany({ where: { projectId: id } }),
        this.prisma.apiUsageLog.deleteMany({ where: { projectId: id } }),
        this.prisma.project.delete({ where: { id } }),
      ]);
      this.logger.log(`Deleted project ${id}`);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('Project', id);
        }
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('Project', 'unknown reference');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('delete', 'Project', error as Error);
    }
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
          // Sub-workflow runs belong to their parent run's tree, not to the project's run list
          where: { parentRunId: null },
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
        workflowDefVersion: w.workflowDefVersion,
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

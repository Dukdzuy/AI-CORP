import { Injectable } from '@nestjs/common';
import {
  IWorkflowRepository,
  WorkflowRunDTO,
  WorkflowStepDTO,
  CreateWorkflowRunData,
  UpdateWorkflowRunData,
  CreateWorkflowStepData,
  UpdateWorkflowStepData,
} from '../../domain/repositories';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  EntityNotFoundException,
  RepositoryException,
  ForeignKeyViolationException,
  DatabaseConnectionException,
} from '../../domain/exceptions';

/**
 * Prisma implementation of IWorkflowRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaWorkflowRepository implements IWorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  // WorkflowRun operations
  async findRunById(runId: string): Promise<WorkflowRunDTO | null> {
    try {
      const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
      if (!run) return null;
      return this.mapRunToDTO(run);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findRunById', 'WorkflowRun', error as Error);
    }
  }

  async findRunsByProjectId(
    projectId: string,
    options?: { limit?: number }
  ): Promise<WorkflowRunDTO[]> {
    try {
      const runs = await this.prisma.workflowRun.findMany({
        where: { projectId },
        orderBy: { startedAt: 'desc' },
        take: options?.limit,
      });
      return runs.map((r) => this.mapRunToDTO(r));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findRunsByProjectId', 'WorkflowRun', error as Error);
    }
  }

  async createRun(data: CreateWorkflowRunData): Promise<WorkflowRunDTO> {
    try {
      const run = await this.prisma.workflowRun.create({
        data: {
          projectId: data.projectId,
          workflowDefId: data.workflowDefId,
          status: data.status || 'running',
          currentNodeId: data.currentNodeId,
          context: data.context,
        },
      });
      return this.mapRunToDTO(run);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('WorkflowRun', 'Project');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('createRun', 'WorkflowRun', error as Error);
    }
  }

  async updateRun(runId: string, data: UpdateWorkflowRunData): Promise<WorkflowRunDTO> {
    try {
      const run = await this.prisma.workflowRun.update({
        where: { id: runId },
        data,
      });
      return this.mapRunToDTO(run);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('WorkflowRun', runId);
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('updateRun', 'WorkflowRun', error as Error);
    }
  }

  async deleteRun(runId: string): Promise<void> {
    try {
      // Delete related steps first
      await this.prisma.workflowStep.deleteMany({ where: { workflowRunId: runId } });
      await this.prisma.approval.deleteMany({ where: { workflowRunId: runId } });
      await this.prisma.workflowRun.delete({ where: { id: runId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('WorkflowRun', runId);
        }
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('WorkflowRun', 'WorkflowStep or Approval');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('deleteRun', 'WorkflowRun', error as Error);
    }
  }

  // WorkflowStep operations
  async findStepById(stepId: string): Promise<WorkflowStepDTO | null> {
    try {
      const step = await this.prisma.workflowStep.findUnique({ where: { id: stepId } });
      if (!step) return null;
      return this.mapStepToDTO(step);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findStepById', 'WorkflowStep', error as Error);
    }
  }

  async findStepsByRunId(runId: string): Promise<WorkflowStepDTO[]> {
    try {
      const steps = await this.prisma.workflowStep.findMany({
        where: { workflowRunId: runId },
        orderBy: { startedAt: 'asc' },
      });
      return steps.map((s) => this.mapStepToDTO(s));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findStepsByRunId', 'WorkflowStep', error as Error);
    }
  }

  async createStep(data: CreateWorkflowStepData): Promise<WorkflowStepDTO> {
    try {
      const step = await this.prisma.workflowStep.create({
        data: {
          workflowRunId: data.workflowRunId,
          taskId: data.taskId,
          nodeId: data.nodeId,
          agentRole: data.agentRole,
          status: data.status || 'pending',
          input: data.input,
        },
      });
      return this.mapStepToDTO(step);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('WorkflowStep', 'WorkflowRun or Task');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('createStep', 'WorkflowStep', error as Error);
    }
  }

  async updateStep(stepId: string, data: UpdateWorkflowStepData): Promise<WorkflowStepDTO> {
    try {
      const step = await this.prisma.workflowStep.update({
        where: { id: stepId },
        data,
      });
      return this.mapStepToDTO(step);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('WorkflowStep', stepId);
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('updateStep', 'WorkflowStep', error as Error);
    }
  }

  async deleteStepsByRunId(runId: string): Promise<void> {
    try {
      await this.prisma.workflowStep.deleteMany({ where: { workflowRunId: runId } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('deleteStepsByRunId', 'WorkflowStep', error as Error);
    }
  }

  private mapRunToDTO(run: any): WorkflowRunDTO {
    return {
      id: run.id,
      projectId: run.projectId,
      workflowDefId: run.workflowDefId,
      status: run.status,
      currentNodeId: run.currentNodeId,
      context: run.context,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
    };
  }

  private mapStepToDTO(step: any): WorkflowStepDTO {
    return {
      id: step.id,
      workflowRunId: step.workflowRunId,
      taskId: step.taskId,
      nodeId: step.nodeId,
      agentRole: step.agentRole,
      status: step.status,
      input: step.input,
      output: step.output,
      error: step.error,
      retryCount: step.retryCount,
      startedAt: step.startedAt,
      completedAt: step.completedAt,
      durationMs: step.durationMs,
    };
  }
}

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

/**
 * Prisma implementation of IWorkflowRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaWorkflowRepository implements IWorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  // WorkflowRun operations
  async findRunById(runId: string): Promise<WorkflowRunDTO | null> {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) return null;
    return this.mapRunToDTO(run);
  }

  async findRunsByProjectId(
    projectId: string,
    options?: { limit?: number }
  ): Promise<WorkflowRunDTO[]> {
    const runs = await this.prisma.workflowRun.findMany({
      where: { projectId },
      orderBy: { startedAt: 'desc' },
      take: options?.limit,
    });
    return runs.map((r) => this.mapRunToDTO(r));
  }

  async createRun(data: CreateWorkflowRunData): Promise<WorkflowRunDTO> {
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
  }

  async updateRun(runId: string, data: UpdateWorkflowRunData): Promise<WorkflowRunDTO> {
    const run = await this.prisma.workflowRun.update({
      where: { id: runId },
      data,
    });
    return this.mapRunToDTO(run);
  }

  async deleteRun(runId: string): Promise<void> {
    // Delete related steps first
    await this.prisma.workflowStep.deleteMany({ where: { workflowRunId: runId } });
    await this.prisma.approval.deleteMany({ where: { workflowRunId: runId } });
    await this.prisma.workflowRun.delete({ where: { id: runId } });
  }

  // WorkflowStep operations
  async findStepById(stepId: string): Promise<WorkflowStepDTO | null> {
    const step = await this.prisma.workflowStep.findUnique({ where: { id: stepId } });
    if (!step) return null;
    return this.mapStepToDTO(step);
  }

  async findStepsByRunId(runId: string): Promise<WorkflowStepDTO[]> {
    const steps = await this.prisma.workflowStep.findMany({
      where: { workflowRunId: runId },
      orderBy: { startedAt: 'asc' },
    });
    return steps.map((s) => this.mapStepToDTO(s));
  }

  async createStep(data: CreateWorkflowStepData): Promise<WorkflowStepDTO> {
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
  }

  async updateStep(stepId: string, data: UpdateWorkflowStepData): Promise<WorkflowStepDTO> {
    const step = await this.prisma.workflowStep.update({
      where: { id: stepId },
      data,
    });
    return this.mapStepToDTO(step);
  }

  async deleteStepsByRunId(runId: string): Promise<void> {
    await this.prisma.workflowStep.deleteMany({ where: { workflowRunId: runId } });
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

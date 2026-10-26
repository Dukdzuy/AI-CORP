import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  IWorkflowEngineRepository,
  CreateRunInput,
  UpdateRunInput,
  CreateStepInput,
  UpdateStepInput,
  CreateApprovalInput,
} from './workflow-engine.repository';

/**
 * Prisma implementation of IWorkflowEngineRepository.
 * A thin pass-through: queries and errors are exactly what the engine
 * issued before it was moved behind this repository.
 */
@Injectable()
export class PrismaWorkflowEngineRepository implements IWorkflowEngineRepository {
  constructor(private readonly prisma: PrismaService) {}

  createRun(data: CreateRunInput) {
    return this.prisma.workflowRun.create({ data });
  }

  findRunById(runId: string) {
    return this.prisma.workflowRun.findUnique({ where: { id: runId } });
  }

  findRunsByStatus(status: string) {
    return this.prisma.workflowRun.findMany({
      where: {
        status
      }
    });
  }

  updateRun(runId: string, data: UpdateRunInput) {
    return this.prisma.workflowRun.update({
      where: { id: runId },
      data
    });
  }

  createStep(data: CreateStepInput) {
    return this.prisma.workflowStep.create({ data });
  }

  updateStep(stepId: string, data: UpdateStepInput) {
    return this.prisma.workflowStep.update({
      where: { id: stepId },
      data
    });
  }

  findProjectWithOwner(projectId: string) {
    return this.prisma.project.findUnique({
      where: { id: projectId },
      include: { createdBy: true }
    });
  }

  updateProjectStatus(projectId: string, status: string) {
    return this.prisma.project.update({
      where: { id: projectId },
      data: { status }
    });
  }

  findLatestTaskByStatus(projectId: string, status: string) {
    return this.prisma.task.findFirst({
      where: {
        projectId,
        status,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  updateTaskStatus(taskId: string, status: string) {
    return this.prisma.task.update({
      where: { id: taskId },
      data: { status },
    });
  }

  createApproval(data: CreateApprovalInput) {
    return this.prisma.approval.create({ data });
  }
}

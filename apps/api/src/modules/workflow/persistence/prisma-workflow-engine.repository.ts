import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  IWorkflowEngineRepository,
  CreateRunInput,
  UpdateRunInput,
  CreateStepInput,
  UpdateStepInput,
  CreateApprovalInput,
  CreateSnapshotInput,
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
        status,
        parentRunId: null
      }
    });
  }

  findChildRuns(parentRunId: string) {
    return this.prisma.workflowRun.findMany({
      where: { parentRunId },
      orderBy: { startedAt: 'asc' }
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

  findStepsByRun(runId: string) {
    return this.prisma.workflowStep.findMany({
      where: { workflowRunId: runId },
      orderBy: { startedAt: 'asc' }
    });
  }

  createSnapshot(data: CreateSnapshotInput) {
    return this.prisma.workflowSnapshot.create({ data });
  }

  findSnapshots(runId: string) {
    return this.prisma.workflowSnapshot.findMany({
      where: { workflowRunId: runId },
      orderBy: { sequence: 'asc' }
    });
  }

  deleteSnapshotsAfter(runId: string, sequence: number) {
    return this.prisma.workflowSnapshot.deleteMany({
      where: { workflowRunId: runId, sequence: { gt: sequence } }
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

  createApproval(data: CreateApprovalInput) {
    return this.prisma.approval.create({ data });
  }

  async cancelPendingApprovals(runId: string) {
    const result = await this.prisma.approval.updateMany({
      where: { workflowRunId: runId, status: 'pending' },
      data: { status: 'cancelled', respondedAt: new Date(), comment: 'Cancelled by workflow rollback' }
    });
    return result.count;
  }
}

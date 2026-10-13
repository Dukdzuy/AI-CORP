import { Injectable } from '@nestjs/common';
import {
  IApprovalRepository,
  ApprovalDTO,
  CreateApprovalData,
  UpdateApprovalData,
} from '../../domain/repositories';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Prisma implementation of IApprovalRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaApprovalRepository implements IApprovalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ApprovalDTO | null> {
    const approval = await this.prisma.approval.findUnique({ where: { id } });
    if (!approval) return null;
    return this.mapToDTO(approval);
  }

  async findByProjectId(projectId: string): Promise<ApprovalDTO[]> {
    const approvals = await this.prisma.approval.findMany({
      where: { workflowRun: { projectId } },
      orderBy: { requestedAt: 'desc' },
    });
    return approvals.map((a) => this.mapToDTO(a));
  }

  async findPending(): Promise<ApprovalDTO[]> {
    const approvals = await this.prisma.approval.findMany({
      where: { status: 'pending' },
      orderBy: { requestedAt: 'asc' },
    });
    return approvals.map((a) => this.mapToDTO(a));
  }

  async findPendingByWorkflowRun(workflowRunId: string): Promise<ApprovalDTO[]> {
    const approvals = await this.prisma.approval.findMany({
      where: { workflowRunId, status: 'pending' },
      orderBy: { requestedAt: 'asc' },
    });
    return approvals.map((a) => this.mapToDTO(a));
  }

  async create(data: CreateApprovalData): Promise<ApprovalDTO> {
    const approval = await this.prisma.approval.create({
      data: {
        workflowRunId: data.workflowRunId,
        userId: data.userId,
        approvalType: data.approvalType,
        requestData: data.requestData,
        status: data.status || 'pending',
      },
    });
    return this.mapToDTO(approval);
  }

  async update(id: string, data: UpdateApprovalData): Promise<ApprovalDTO> {
    const approval = await this.prisma.approval.update({
      where: { id },
      data,
    });
    return this.mapToDTO(approval);
  }

  async approve(id: string, comment?: string): Promise<ApprovalDTO> {
    return this.update(id, {
      status: 'approved',
      comment,
      respondedAt: new Date(),
    });
  }

  async reject(id: string, comment?: string): Promise<ApprovalDTO> {
    return this.update(id, {
      status: 'rejected',
      comment,
      respondedAt: new Date(),
    });
  }

  private mapToDTO(approval: any): ApprovalDTO {
    return {
      id: approval.id,
      workflowRunId: approval.workflowRunId,
      userId: approval.userId,
      approvalType: approval.approvalType,
      status: approval.status,
      requestData: approval.requestData,
      comment: approval.comment,
      requestedAt: approval.requestedAt,
      respondedAt: approval.respondedAt,
    };
  }
}

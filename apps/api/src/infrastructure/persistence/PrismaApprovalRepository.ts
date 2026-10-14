import { Injectable } from '@nestjs/common';
import {
  IApprovalRepository,
  ApprovalDTO,
  CreateApprovalData,
  UpdateApprovalData,
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
 * Prisma implementation of IApprovalRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaApprovalRepository implements IApprovalRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<ApprovalDTO | null> {
    try {
      const approval = await this.prisma.approval.findUnique({ where: { id } });
      if (!approval) return null;
      return this.mapToDTO(approval);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findById', 'Approval', error as Error);
    }
  }

  async findByProjectId(projectId: string): Promise<ApprovalDTO[]> {
    try {
      const approvals = await this.prisma.approval.findMany({
        where: { workflowRun: { projectId } },
        orderBy: { requestedAt: 'desc' },
      });
      return approvals.map((a) => this.mapToDTO(a));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findByProjectId', 'Approval', error as Error);
    }
  }

  async findPending(): Promise<ApprovalDTO[]> {
    try {
      const approvals = await this.prisma.approval.findMany({
        where: { status: 'pending' },
        orderBy: { requestedAt: 'asc' },
      });
      return approvals.map((a) => this.mapToDTO(a));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findPending', 'Approval', error as Error);
    }
  }

  async findPendingByWorkflowRun(workflowRunId: string): Promise<ApprovalDTO[]> {
    try {
      const approvals = await this.prisma.approval.findMany({
        where: { workflowRunId, status: 'pending' },
        orderBy: { requestedAt: 'asc' },
      });
      return approvals.map((a) => this.mapToDTO(a));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findPendingByWorkflowRun', 'Approval', error as Error);
    }
  }

  async create(data: CreateApprovalData): Promise<ApprovalDTO> {
    try {
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('Approval', 'WorkflowRun or User');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('create', 'Approval', error as Error);
    }
  }

  async update(id: string, data: UpdateApprovalData): Promise<ApprovalDTO> {
    try {
      const approval = await this.prisma.approval.update({
        where: { id },
        data,
      });
      return this.mapToDTO(approval);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('Approval', id);
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('update', 'Approval', error as Error);
    }
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

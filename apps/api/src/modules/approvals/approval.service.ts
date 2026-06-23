import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { WebSocketEvent, WebSocketEventType } from '@ai-corp/shared-types';

export interface CreateApprovalParams {
  workflowRunId: string;
  userId: string;
  approvalType: string;
  requestData: any;
}

@Injectable()
export class ApprovalService {
  private readonly logger = new Logger(ApprovalService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => WorkflowEngine)) private readonly workflowEngine: WorkflowEngine,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  /**
   * Create a new approval request and set its initial status to pending.
   * This should trigger the workflow engine to pause execution until human responds.
   */
  async createApprovalRequest(params: CreateApprovalParams) {
    this.logger.log(`Creating approval request for workflow run ${params.workflowRunId} for user ${params.userId}`);

    const run = await this.prisma.workflowRun.findUnique({ where: { id: params.workflowRunId } });
    if (!run) throw new Error('Workflow run not found');

    const approval = await this.prisma.approval.create({
      data: {
        workflowRunId: params.workflowRunId,
        userId: params.userId,
        approvalType: params.approvalType,
        requestData: params.requestData,
        status: 'pending',
      },
    });

    // Notify the user via WebSocket
    const event: WebSocketEvent = {
      type: WebSocketEventType.HUMAN_APPROVAL_REQUIRED,
      data: {
        approvalId: approval.id,
        workflowRunId: approval.workflowRunId,
        projectId: run.projectId,
        approvalType: approval.approvalType,
        requestData: approval.requestData as Record<string, unknown>,
        requestedAt: new Date()
      },
      timestamp: new Date()
    };
    this.websocketGateway.sendToUser(params.userId, event);

    return approval;
  }

  async listPendingApprovals(userId: string, projectId?: string) {
    const where: any = {
      status: 'pending',
      userId,
    };

    if (projectId) {
      where.workflowRun = { projectId };
    }

    return this.prisma.approval.findMany({
      where,
      include: { workflowRun: { select: { id: true, projectId: true, currentNodeId: true } } },
      orderBy: { requestedAt: 'desc' },
    });
  }

  /**
   * Handles human response to an approval request.
   * Requirement 17.7: pending -> approved/rejected only
   */
  async handleApprovalResponse(approvalId: string, status: 'approved' | 'rejected', comment?: string) {
    const approval = await this.prisma.approval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new Error('Approval request not found');

    if (approval.status !== 'pending') {
      throw new Error(`Cannot transition approval from status '${approval.status}'`);
    }

    const updatedApproval = await this.prisma.approval.update({
      where: { id: approvalId },
      data: {
        status,
        comment,
        respondedAt: new Date(),
      },
    });

    this.logger.log(`Approval ${approvalId} was ${status}. Resuming workflow run ${updatedApproval.workflowRunId}.`);

    // First resume workflow execution (sets status back to 'running', skip auto-process)
    await this.workflowEngine.resumeWorkflow(updatedApproval.workflowRunId, true);

    // Then transition to next node based on approval decision
    const edgeCondition = status === 'approved' ? 'onApprove' : 'onReject';
    await this.workflowEngine.transitionToNextNode(updatedApproval.workflowRunId, edgeCondition);

    // Now process the next node
    await this.workflowEngine.processCurrentNode(updatedApproval.workflowRunId);

    return updatedApproval;
  }
}

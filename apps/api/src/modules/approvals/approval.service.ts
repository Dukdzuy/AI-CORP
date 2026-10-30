import { ConflictException, Injectable, Logger, Inject, NotFoundException, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { WebSocketEvent, WebSocketEventType } from '@ai-corp/shared-types';
import { EventBus } from '../../domain/events/EventBus';
import { ApprovalRequestedEvent } from '../../domain/events/ApprovalRequestedEvent';

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
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly eventBus: EventBus
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

    // Publish ApprovalRequestedEvent via injected EventBus (satisfies DIP)
    await this.eventBus.publish(new ApprovalRequestedEvent(
      approval.id,
      run.projectId,
      approval.workflowRunId,
      params.userId,
      approval.approvalType,
      approval.requestData
    )).catch(err => this.logger.error(`Failed to publish ApprovalRequestedEvent: ${err.message}`));

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

  /** The user's pending approvals; an admin (who may answer any approval) sees everyone's */
  async listPendingApprovals(userId: string, projectId?: string, includeAll = false) {
    const where: any = { status: 'pending' };
    if (!includeAll) where.userId = userId;

    if (projectId) {
      where.workflowRun = { projectId };
    }

    return this.prisma.approval.findMany({
      where,
      include: {
        workflowRun: { select: { id: true, projectId: true, currentNodeId: true, project: { select: { name: true } } } },
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { requestedAt: 'desc' },
    });
  }

  /**
   * Handles human response to an approval request.
   * Requirement 17.7: pending -> approved/rejected only. The status change is conditional on the
   * approval still being pending, so a double click or two people answering at once lands once.
   */
  async handleApprovalResponse(approvalId: string, status: 'approved' | 'rejected', comment?: string) {
    const approval = await this.prisma.approval.findUnique({ where: { id: approvalId } });
    if (!approval) throw new NotFoundException(`Approval request ${approvalId} not found`);

    const { count } = await this.prisma.approval.updateMany({
      where: { id: approvalId, status: 'pending' },
      data: { status, comment, respondedAt: new Date() },
    });
    if (count === 0) {
      const current = await this.prisma.approval.findUnique({ where: { id: approvalId } });
      throw new ConflictException(`This approval was already ${current?.status ?? approval.status}`);
    }
    const updatedApproval = { ...approval, status, comment: comment ?? null, respondedAt: new Date() };

    this.logger.log(`Approval ${approvalId} was ${status}. Resuming workflow run ${updatedApproval.workflowRunId}.`);

    // The decision and its reason go into the run's variables for the agents that run next
    await this.workflowEngine.recordApprovalDecision(updatedApproval.workflowRunId, status, comment);

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

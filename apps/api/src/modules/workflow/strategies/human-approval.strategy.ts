import { WorkflowNode, NodeResult } from '@ai-corp/shared-types';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { IWorkflowEngineRepository, WorkflowRunRecord } from '../persistence/workflow-engine.repository';
import { NodeExecutionStrategy, NodeExecutionContext } from './node-execution-strategy';
import { IEventPublisher } from '../../../domain/events/IEventPublisher';
import { ApprovalRequestedEvent } from '../../../domain/events/ApprovalRequestedEvent';

/**
 * Execute a human approval node
 * Implements Requirement 10: Human-in-the-loop approvals
 * Implements Requirement 9: WebSocket events for approval requests
 */
export class HumanApprovalStrategy implements NodeExecutionStrategy {
  readonly type = 'human_approval' as const;

  constructor(
    private readonly repository: IWorkflowEngineRepository,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly events?: IEventPublisher
  ) {}

  async execute(node: WorkflowNode, run: WorkflowRunRecord, ctx: NodeExecutionContext): Promise<NodeResult> {
    ctx.logger.log(`Reached human approval node ${node.id} for workflow run ${run.id}`);

    // Get project owner for approval
    const project = await this.repository.findProjectWithOwner(run.projectId);

    if (!project) {
      throw new Error(`Project ${run.projectId} not found`);
    }

    // Create approval request
    const approvalType = (node.metadata as any)?.approvalType || node.taskType || 'workflow_approval';
    const requestData = {
      nodeId: node.id,
      workflowRunId: run.id,
      context: run.context,
      message: (node.metadata as any)?.message || 'Approval required to continue workflow execution',
      ...((node.metadata as any)?.requestData || {})
    };

    const approval = await this.repository.createApproval({
      workflowRunId: run.id,
      userId: project.createdById,
      approvalType,
      requestData: requestData as any,
      status: 'pending',
    });

    // Emit approval required event (Req 9, Req 10) — send to both project and user
    const approvalEvent = {
      type: 'human:approval_required',
      data: {
        approvalId: approval.id,
        workflowRunId: run.id,
        projectId: run.projectId,
        approvalType,
        requestData,
        requestedAt: new Date()
      },
      timestamp: new Date()
    };
    this.websocketGateway.sendToProjectAndUser(run.projectId, project.createdById, approvalEvent);

    // Phase 5: this is the path every workflow takes, so the domain event is raised here
    // (audit trail + `approval.requested` webhook); before, nothing raised it at run time
    await this.events
      ?.publish(new ApprovalRequestedEvent(approval.id, run.projectId, run.id, project.createdById, approvalType, requestData))
      .catch(err => ctx.logger.error(`Failed to publish ApprovalRequestedEvent: ${err.message}`));

    ctx.logger.log(`Approval request ${approval.id} created and notification sent to user ${project.createdById}`);

    // Return pending_approval status to pause workflow
    return {
      status: 'pending_approval',
      output: {
        approvalId: approval.id,
        approvalType,
        requestData
      }
    };
  }
}

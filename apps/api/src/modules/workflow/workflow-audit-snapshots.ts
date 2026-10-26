import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { APPROVAL_REPOSITORY, IApprovalRepository, IWorkflowRepository, WORKFLOW_REPOSITORY } from '../../domain/repositories';
import { AuditSnapshotRegistry } from '../audit/audit-snapshot.registry';

/** Before/after of workflow runs (pause, resume, rollback) and approvals in the audit log (Task 21) */
@Injectable()
export class WorkflowAuditSnapshots implements OnModuleInit {
  constructor(
    private readonly registry: AuditSnapshotRegistry,
    @Inject(WORKFLOW_REPOSITORY) private readonly workflows: IWorkflowRepository,
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: IApprovalRepository
  ) {}

  onModuleInit() {
    this.registry.register('WorkflowRun', async id => {
      const run = await this.workflows.findRunById(id);
      return run && { id: run.id, projectId: run.projectId, status: run.status, currentNodeId: run.currentNodeId, workflowDefId: run.workflowDefId };
    });
    this.registry.register('Approval', id => this.approvals.findById(id));
  }
}

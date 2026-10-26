import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Principal } from '../../domain/security';
import {
  APPROVAL_REPOSITORY,
  IApprovalRepository,
  IProjectRepository,
  IWorkflowRepository,
  PROJECT_REPOSITORY,
  WORKFLOW_REPOSITORY,
} from '../../domain/repositories';
import { AuditLogService } from '../audit/audit-log.service';

/**
 * Resource-level checks that a route decorator can't express (Phase 5, Task 20):
 * "may this principal act on *this* project / run / approval?".
 *
 *  - a project (and the workflow runs of it) can be changed by its creator or an admin
 *  - an approval can be answered by the user it was assigned to or an admin
 *
 * Denials are audited like guard denials, then answered with 403.
 */
@Injectable()
export class AuthorizationService {
  constructor(
    private readonly audit: AuditLogService,
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
    @Inject(WORKFLOW_REPOSITORY) private readonly workflows: IWorkflowRepository,
    @Inject(APPROVAL_REPOSITORY) private readonly approvals: IApprovalRepository
  ) {}

  async assertOwner(
    principal: Principal,
    ownerId: string | null | undefined,
    resource: { type: string; id: string; verb: string },
    request?: any
  ): Promise<void> {
    if (principal.owns(ownerId)) return;
    await this.audit.recordDenied(principal, `${resource.verb} ${resource.type} ${resource.id}`, 'owner or admin', request);
    throw new ForbiddenException(`Only the owner of this ${resource.type.toLowerCase()} or an admin can ${resource.verb} it`);
  }

  async assertProjectOwner(principal: Principal, projectId: string, verb: string, request?: any): Promise<void> {
    const project = await this.projects.findById(projectId);
    if (!project) throw new NotFoundException(`Project with ID ${projectId} not found.`);
    await this.assertOwner(principal, project.createdById, { type: 'Project', id: projectId, verb }, request);
  }

  async assertRunOwner(principal: Principal, runId: string, verb: string, request?: any): Promise<void> {
    const run = await this.workflows.findRunById(runId);
    if (!run) throw new NotFoundException(`Workflow run ${runId} not found`);
    await this.assertProjectOwner(principal, run.projectId, verb, request);
  }

  async assertApprovalAssignee(principal: Principal, approvalId: string, request?: any): Promise<void> {
    const approval = await this.approvals.findById(approvalId);
    if (!approval) throw new NotFoundException(`Approval request ${approvalId} not found`);
    await this.assertOwner(principal, approval.userId, { type: 'Approval', id: approvalId, verb: 'answer' }, request);
  }
}

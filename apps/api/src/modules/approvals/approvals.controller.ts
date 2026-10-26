import { Controller, Get, Post, Param, Body, Query, Req } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { Principal } from '../../domain/security';
import { CurrentPrincipal, RequirePermission } from '../access/access.decorators';
import { AuthorizationService } from '../access/authorization.service';
import { Audited } from '../audit/audit.decorators';
import { ApprovalService } from './approval.service';

@Controller('approvals')
export class ApprovalsController {
  constructor(
    private readonly approvalService: ApprovalService,
    private readonly authorization: AuthorizationService
  ) {}

  @Get()
  @RequirePermission(Permission.PROJECT_READ)
  async listPendingApprovals(@Req() req: any, @Query('projectId') projectId?: string) {
    return this.approvalService.listPendingApprovals(req.user.id, projectId);
  }

  @Post(':id/approve')
  @RequirePermission(Permission.APPROVAL_GRANT)
  @Audited({ action: 'approval.approve', resourceType: 'Approval', idParam: 'id' })
  async approve(@Param('id') id: string, @CurrentPrincipal() principal: Principal, @Req() req: any, @Body('comment') comment?: string) {
    await this.authorization.assertApprovalAssignee(principal, id, req);
    return this.approvalService.handleApprovalResponse(id, 'approved', comment);
  }

  @Post(':id/reject')
  @RequirePermission(Permission.APPROVAL_GRANT)
  @Audited({ action: 'approval.reject', resourceType: 'Approval', idParam: 'id' })
  async reject(@Param('id') id: string, @CurrentPrincipal() principal: Principal, @Req() req: any, @Body('comment') comment?: string) {
    await this.authorization.assertApprovalAssignee(principal, id, req);
    return this.approvalService.handleApprovalResponse(id, 'rejected', comment);
  }
}

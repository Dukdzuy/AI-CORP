import { Controller, Get, Post, Param, Body, Query, Req, UseGuards } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalService: ApprovalService) {}

  @Get()
  async listPendingApprovals(@Req() req: any, @Query('projectId') projectId?: string) {
    return this.approvalService.listPendingApprovals(req.user.id, projectId);
  }

  @Post(':id/approve')
  async approve(@Param('id') id: string, @Body('comment') comment?: string) {
    return this.approvalService.handleApprovalResponse(id, 'approved', comment);
  }

  @Post(':id/reject')
  async reject(@Param('id') id: string, @Body('comment') comment?: string) {
    return this.approvalService.handleApprovalResponse(id, 'rejected', comment);
  }
}

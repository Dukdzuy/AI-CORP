import { Module, forwardRef } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { ApprovalsController } from './approvals.controller';
import { WorkflowModule } from '../workflow/workflow.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [forwardRef(() => WorkflowModule), forwardRef(() => WebSocketModule)],
  controllers: [ApprovalsController],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalsModule {}

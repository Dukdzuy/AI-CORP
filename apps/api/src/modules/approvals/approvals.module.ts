import { Module, forwardRef } from '@nestjs/common';
import { ApprovalService } from './approval.service';
import { WorkflowModule } from '../workflow/workflow.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [forwardRef(() => WorkflowModule), WebSocketModule],
  providers: [ApprovalService],
  exports: [ApprovalService],
})
export class ApprovalsModule {}

import { Module } from '@nestjs/common';
import { AgentOrchestratorService } from './agent-orchestrator.service';
import { AgentMessageService } from './agent-message.service';
import { AgentsModule } from '../agents/agents.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [AgentsModule, WebSocketModule],
  providers: [AgentOrchestratorService, AgentMessageService],
  exports: [AgentOrchestratorService, AgentMessageService],
})
export class OrchestratorModule {}

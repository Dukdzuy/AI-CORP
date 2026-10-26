import { Module } from '@nestjs/common';
import { WorkflowValidator } from './workflow-validator';
import { WorkflowEngine } from './workflow.engine';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { WebSocketModule } from '../websocket/websocket.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';

@Module({
  imports: [WebSocketModule, OrchestratorModule, InfrastructureModule],
  providers: [WorkflowValidator, WorkflowEngine, WorkflowDefinitionService],
  exports: [WorkflowValidator, WorkflowEngine, WorkflowDefinitionService],
})
export class WorkflowModule {}

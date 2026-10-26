import { Module } from '@nestjs/common';
import { WorkflowValidator } from './workflow-validator';
import { WorkflowEngine } from './workflow.engine';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { WebSocketModule } from '../websocket/websocket.module';
import { OrchestratorModule } from '../orchestrator/orchestrator.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { WORKFLOW_ENGINE_REPOSITORY } from './persistence/workflow-engine.repository';
import { PrismaWorkflowEngineRepository } from './persistence/prisma-workflow-engine.repository';
import { QualityGateHandler } from './handlers/quality-gate.handler';
import { QualityGateStrategy } from './strategies/quality-gate.strategy';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [WebSocketModule, OrchestratorModule, InfrastructureModule, WorkspaceModule, PrismaModule],
  providers: [
    WorkflowValidator,
    WorkflowEngine,
    WorkflowDefinitionService,
    QualityGateHandler,
    QualityGateStrategy,
    { provide: WORKFLOW_ENGINE_REPOSITORY, useClass: PrismaWorkflowEngineRepository },
  ],
  exports: [WorkflowValidator, WorkflowEngine, WorkflowDefinitionService],
})
export class WorkflowModule {}

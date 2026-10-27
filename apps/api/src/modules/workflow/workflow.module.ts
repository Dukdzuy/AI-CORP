import { WorkflowAuditSnapshots } from './workflow-audit-snapshots';
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
import { AgentCollaborationStrategy } from './collaboration/agent-collaboration.strategy';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { SubWorkflowStrategy } from './strategies/sub-workflow.strategy';
import { WORKFLOW_DEFINITION_REPOSITORY } from './persistence/workflow-definition.repository';
import { PrismaWorkflowDefinitionRepository } from './persistence/prisma-workflow-definition.repository';
import { BUILT_IN_TEMPLATES, WORKFLOW_TEMPLATES, WorkflowTemplateCatalog } from './templates/workflow-template.catalog';
import { WorkflowRunQueryService } from './workflow-run-query.service';
import { WorkflowsController } from './workflows.controller';
import { EstimationModule } from '../estimation/estimation.module';

@Module({
  imports: [WebSocketModule, OrchestratorModule, InfrastructureModule, WorkspaceModule, PrismaModule, EstimationModule],
  controllers: [WorkflowsController],
  providers: [
    WorkflowAuditSnapshots,
    WorkflowValidator,
    WorkflowEngine,
    WorkflowDefinitionService,
    QualityGateHandler,
    QualityGateStrategy,
    AgentCollaborationStrategy,
    SubWorkflowStrategy,
    WorkflowTemplateCatalog,
    WorkflowRunQueryService,
    { provide: WORKFLOW_TEMPLATES, useFactory: BUILT_IN_TEMPLATES },
    { provide: WORKFLOW_ENGINE_REPOSITORY, useClass: PrismaWorkflowEngineRepository },
    { provide: WORKFLOW_DEFINITION_REPOSITORY, useClass: PrismaWorkflowDefinitionRepository },
  ],
  exports: [WorkflowValidator, WorkflowEngine, WorkflowDefinitionService],
})
export class WorkflowModule {}

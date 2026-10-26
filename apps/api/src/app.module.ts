import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { LLMModule } from './modules/llm';
import { ProjectsModule } from './modules/projects/projects.module';
import { AgentsModule } from './modules/agents/agents.module';
import { MemoryModule } from './modules/memory/memory.module';
import { ToolsModule } from './modules/tools/tools.module';
import { WebSocketModule } from './modules/websocket/websocket.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { ApprovalsModule } from './modules/approvals/approvals.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrchestratorModule } from './modules/orchestrator/orchestrator.module';
import { HealthModule } from './modules/health/health.module';
import { CostModule } from './modules/cost/cost.module';
import { EventsModule } from './modules/events/events.module';
import { OoadMetricsModule } from './modules/ooad-metrics/ooad-metrics.module';
import { ProjectArtifactsModule } from './modules/project-artifacts/project-artifacts.module';
import { EnvValidator } from './modules/security/env-validator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    InfrastructureModule,
    EventsModule, // Task 10: Import EventsModule (@Global module)
    LLMModule,
    ProjectsModule,
    AgentsModule,
    MemoryModule,
    ToolsModule,
    WebSocketModule,
    WorkflowModule,
    ApprovalsModule,
    AuthModule,
    OrchestratorModule,
    HealthModule,
    CostModule,
    OoadMetricsModule,
    ProjectArtifactsModule,
  ],
  providers: [EnvValidator],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
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
import { EnvValidator } from './modules/security/env-validator';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
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
  ],
  providers: [EnvValidator],
})
export class AppModule {}

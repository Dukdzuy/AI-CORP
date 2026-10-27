import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module';
import { LLMModule } from '../llm/llm.module';
import { ToolsModule } from '../tools/tools.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { TemplateService } from './services/template.service';
import { OOADArtifactService } from './services/ooad-artifact.service';
import { AgentLLMService } from './services/agent-llm.service';
import { TraceabilityService } from './services/traceability.service';
import { ProjectTestRunner } from './services/project-test-runner.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { CodeQualityModule } from '../code-quality/code-quality.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AGENTS, AGENT_CLASSES, agentsProvider } from './agents.registry';

// Import all strategy classes
import {
  CeoThinkingStrategy,
  CeoActionStrategy,
  PmThinkingStrategy,
  PmActionStrategy,
  DevThinkingStrategy,
  DevActionStrategy,
  QaThinkingStrategy,
  QaActionStrategy,
  MarketingThinkingStrategy,
  MarketingActionStrategy,
  BAThinkingStrategy,
  BAActionStrategy,
  ArchitectThinkingStrategy,
  ArchitectActionStrategy,
  QcThinkingStrategy,
  QcActionStrategy,
} from './strategies';

@Module({
  imports: [MemoryModule, LLMModule, ToolsModule, WebSocketModule, PrismaModule, WorkspaceModule, CodeQualityModule],
  providers: [
    // Services
    TemplateService,
    OOADArtifactService,
    AgentLLMService,
    TraceabilityService,
    ProjectTestRunner,
    
    // Strategy Pattern implementations
    CeoThinkingStrategy,
    CeoActionStrategy,
    PmThinkingStrategy,
    PmActionStrategy,
    DevThinkingStrategy,
    DevActionStrategy,
    QaThinkingStrategy,
    QaActionStrategy,
    MarketingThinkingStrategy,
    MarketingActionStrategy,
    BAThinkingStrategy,
    BAActionStrategy,
    ArchitectThinkingStrategy,
    ArchitectActionStrategy,
    QcThinkingStrategy,
    QcActionStrategy,
    
    // Agents (8 roles: CEO, BA, Architect, PM, DEV, QC, QA, Marketing) and the AGENTS registry token
    ...AGENT_CLASSES,
    agentsProvider(),
  ],
  exports: [TemplateService, OOADArtifactService, AgentLLMService, AGENTS],
})
export class AgentsModule {}

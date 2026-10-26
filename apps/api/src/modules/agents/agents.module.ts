import { Module } from '@nestjs/common';
import { CeoAgent } from './ceo.agent';
import { PmAgent } from './pm.agent';
import { DevAgent } from './dev.agent';
import { QaAgent } from './qa.agent';
import { MarketingAgent } from './marketing.agent';
import { BaAgent } from './ba.agent';
import { ArchitectAgent } from './architect.agent';
import { QcAgent } from './qc.agent';
import { MemoryModule } from '../memory/memory.module';
import { LLMModule } from '../llm/llm.module';
import { ToolsModule } from '../tools/tools.module';
import { WebSocketModule } from '../websocket/websocket.module';
import { TemplateService } from './services/template.service';
import { OOADArtifactService } from './services/ooad-artifact.service';
import { AgentLLMService } from './services/agent-llm.service';
import { TraceabilityService } from './services/traceability.service';
import { WorkspaceModule } from '../workspace/workspace.module';
import { PrismaModule } from '../../prisma/prisma.module';

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
  imports: [MemoryModule, LLMModule, ToolsModule, WebSocketModule, PrismaModule, WorkspaceModule],
  providers: [
    // Services
    TemplateService,
    OOADArtifactService,
    AgentLLMService,
    TraceabilityService,
    
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
    
    // Agent classes (8 roles: CEO, PM, BA, Architect, Dev, QC, QA, Marketing)
    CeoAgent,
    PmAgent,
    DevAgent,
    QaAgent,
    MarketingAgent,
    BaAgent,
    ArchitectAgent,
    QcAgent,
  ],
  exports: [
    TemplateService,
    OOADArtifactService,
    CeoAgent,
    PmAgent,
    DevAgent,
    QaAgent,
    MarketingAgent,
    BaAgent,
    ArchitectAgent,
    QcAgent,
  ],
})
export class AgentsModule {}

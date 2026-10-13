import { Module } from '@nestjs/common';
import { CeoAgent } from './ceo.agent';
import { PmAgent } from './pm.agent';
import { DevAgent } from './dev.agent';
import { QaAgent } from './qa.agent';
import { MarketingAgent } from './marketing.agent';
import { BaAgent } from './ba.agent';
import { ArchitectAgent } from './architect.agent';
import { DevOpsAgent } from './devops.agent';
import { MemoryModule } from '../memory/memory.module';
import { LLMModule } from '../llm/llm.module';
import { ToolsModule } from '../tools/tools.module';
import { WebSocketModule } from '../websocket/websocket.module';

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
  DevOpsThinkingStrategy,
  DevOpsActionStrategy,
} from './strategies';

@Module({
  imports: [MemoryModule, LLMModule, ToolsModule, WebSocketModule],
  providers: [
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
    DevOpsThinkingStrategy,
    DevOpsActionStrategy,
    
    // Agent classes (8 total: 5 existing + 3 new)
    CeoAgent,
    PmAgent,
    DevAgent,
    QaAgent,
    MarketingAgent,
    BaAgent,
    ArchitectAgent,
    DevOpsAgent,
  ],
  exports: [
    CeoAgent,
    PmAgent,
    DevAgent,
    QaAgent,
    MarketingAgent,
    BaAgent,
    ArchitectAgent,
    DevOpsAgent,
  ],
})
export class AgentsModule {}

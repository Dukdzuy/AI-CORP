import { Module } from '@nestjs/common';
import { CeoAgent } from './ceo.agent';
import { PmAgent } from './pm.agent';
import { DevAgent } from './dev.agent';
import { QaAgent } from './qa.agent';
import { MarketingAgent } from './marketing.agent';
import { MemoryModule } from '../memory/memory.module';
import { LLMModule } from '../llm/llm.module';
import { ToolsModule } from '../tools/tools.module';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [MemoryModule, LLMModule, ToolsModule, WebSocketModule],
  providers: [CeoAgent, PmAgent, DevAgent, QaAgent, MarketingAgent],
  exports: [CeoAgent, PmAgent, DevAgent, QaAgent, MarketingAgent],
})
export class AgentsModule {}

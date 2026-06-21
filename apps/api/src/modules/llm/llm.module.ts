import { Module } from '@nestjs/common';
import { LLMProviderFactory } from './llm-provider.factory';
import { NineRouterHealthService } from './nine-router-health.service';
import { ApiUsageService } from './api-usage.service';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebSocketModule],
  providers: [LLMProviderFactory, NineRouterHealthService, ApiUsageService],
  exports: [LLMProviderFactory, NineRouterHealthService, ApiUsageService],
})
export class LLMModule {}

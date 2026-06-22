import { Module } from '@nestjs/common';
import { LLMProviderFactory } from './llm-provider.factory';
import { NineRouterHealthService } from './nine-router-health.service';
import { ApiUsageService } from './api-usage.service';
import { ModelsController } from './models.controller';
import { WebSocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebSocketModule],
  controllers: [ModelsController],
  providers: [LLMProviderFactory, NineRouterHealthService, ApiUsageService],
  exports: [LLMProviderFactory, NineRouterHealthService, ApiUsageService],
})
export class LLMModule {}

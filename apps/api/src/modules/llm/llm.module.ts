import { Module } from '@nestjs/common';
import { LLMProviderFactory } from './llm-provider.factory';
import { NineRouterHealthService } from './nine-router-health.service';
import { ApiUsageService } from './api-usage.service';
import { ModelsController } from './models.controller';
import { WebSocketModule } from '../websocket/websocket.module';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { OpenAICompatibleStrategy } from './providers/openai-compatible.strategy';
import { AnthropicStrategy } from './providers/anthropic.strategy';
import { ProviderStrategyRegistry } from './providers/provider-strategy.registry';
import { ConfiguredProviderRegistry } from './providers/configured-provider.registry';
import { LlmProvidersService } from './providers/llm-providers.service';
import { LlmProvidersController } from './providers/llm-providers.controller';

@Module({
  imports: [WebSocketModule, InfrastructureModule],
  controllers: [ModelsController, LlmProvidersController],
  providers: [
    LLMProviderFactory,
    NineRouterHealthService,
    ApiUsageService,
    // Providers & models configured from the web app
    OpenAICompatibleStrategy,
    AnthropicStrategy,
    ProviderStrategyRegistry,
    ConfiguredProviderRegistry,
    LlmProvidersService,
  ],
  exports: [LLMProviderFactory, NineRouterHealthService, ApiUsageService],
})
export class LLMModule {}

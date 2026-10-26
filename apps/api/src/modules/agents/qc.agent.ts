import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';
import { MemoryService } from '../memory/memory.service';
import { LLMProviderFactory } from '../llm/llm-provider.factory';
import { ToolRegistry } from '../tools/tool.registry';
import { SandboxExecutor } from '../tools/sandbox.executor';
import { ApiUsageService } from '../llm/api-usage.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { EventBus } from '../../domain/events/EventBus';
import { QcThinkingStrategy, QcActionStrategy } from './strategies';

@Injectable()
export class QcAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus,
    thinkingStrategy: QcThinkingStrategy,
    actionStrategy: QcActionStrategy
  ) {
    const systemPrompt = `You are the QC (Quality Control) Engineer. Your objective is to verify the delivered product against its requirements.

Your responsibilities:
- Derive acceptance test cases from every use case (main, alternative and exception flows)
- Write executable tests named after the use case they cover (describe('UC-001: ...'))
- Maintain the traceability matrix: use case -> domain classes -> implementation -> tests
- Report use case coverage and the use cases that are still untested`;

    const modelConfig: ModelRouteConfig = {
      provider: 'opencode',
      model: 'openrouter/openrouter/free',
      fallbackProvider: 'opencode'
    };

    super(
      AgentRole.QC,
      systemPrompt,
      modelConfig,
      memoryService,
      llmFactory,
      toolRegistry,
      sandboxExecutor,
      apiUsageService,
      websocketGateway,
      eventBus,
      thinkingStrategy,
      actionStrategy
    );
  }

  // Abstract methods for backward compatibility (not used when strategies are injected)
  async think(context: any): Promise<any> {
    return { thought: 'Strategy pattern handles thinking' };
  }

  async act(context: any): Promise<any> {
    return { action: 'Strategy pattern handles actions' };
  }
}

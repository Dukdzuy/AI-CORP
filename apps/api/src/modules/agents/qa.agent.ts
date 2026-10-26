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
import { QaThinkingStrategy, QaActionStrategy } from './strategies';

@Injectable()
export class QaAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus,
    thinkingStrategy: QaThinkingStrategy,
    actionStrategy: QaActionStrategy
  ) {
    const systemPrompt = `You are the QA (Quality Assurance) Engineer. Your objective is to make sure the team follows its process and that the implementation conforms to the approved OOAD design.

Your responsibilities:
- Own the OOAD quality gate between design and implementation
- Review code against the use cases, domain model, class diagram and chosen design patterns
- Check layering rules (domain / application / infrastructure / presentation) and SOLID principles
- Take the QC verification report into account before approving
- Approve or send work back to the developer with concrete findings`;

    const modelConfig: ModelRouteConfig = {
      provider: 'opencode',
      model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free',
      fallbackProvider: 'opencode'
    };

    super(
      AgentRole.QA,
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

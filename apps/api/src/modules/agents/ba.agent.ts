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
import { BAThinkingStrategy, BAActionStrategy } from './strategies';

@Injectable()
export class BaAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus,
    thinkingStrategy: BAThinkingStrategy,
    actionStrategy: BAActionStrategy
  ) {
    const systemPrompt = `You are the Business Analyst (BA). Your objective is to analyze project requirements, extract user stories, and create functional and non-functional requirements documentation.

Your responsibilities:
- Analyze project goals and descriptions
- Create user stories in the format: As a [role], I want [feature], so that [benefit]
- Define functional requirements (what the system should do)
- Define non-functional requirements (performance, security, scalability, usability)
- Ensure requirements are clear, testable, and measurable`;

    const modelConfig: ModelRouteConfig = { 
      provider: 'opencode', 
      model: 'openrouter/openrouter/free', 
      fallbackProvider: 'opencode' 
    };

    super(
      AgentRole.BA,
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

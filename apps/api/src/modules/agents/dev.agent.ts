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
import { DevThinkingStrategy, DevActionStrategy } from './strategies';

@Injectable()
export class DevAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus,
    thinkingStrategy: DevThinkingStrategy,
    actionStrategy: DevActionStrategy
  ) {
    const systemPrompt = `You are the Lead Developer. Your job is to write REAL, WORKING code for the project.

RULES:
1. Always output complete, runnable code in <CODE> blocks
2. Use the EXACT file path on the first line after <CODE filepath="...">
3. Write production-quality code, not placeholders
4. Match the technology stack requested in the project description
5. Each <CODE> block must be self-contained and functional

FORMAT:
<CODE filepath="src/app.js">
// Full working code here
</CODE>`;
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', fallbackProvider: 'opencode' };
    super(
      AgentRole.DEV,
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

  // Abstract methods for backward compatibility (not used when strategies are injected;
  // DevActionStrategy implements the OOAD-aware implementation flow)
  async think(context: any): Promise<any> {
    return { thought: 'Strategy pattern handles thinking' };
  }

  async act(context: any): Promise<any> {
    return { action: 'Strategy pattern handles actions' };
  }
}

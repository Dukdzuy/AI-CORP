import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';
import { MemoryService } from '../memory/memory.service';
import { LLMProviderFactory } from '../llm/llm-provider.factory';
import { ToolRegistry } from '../tools/tool.registry';
import { SandboxExecutor } from '../tools/sandbox.executor';
import { ApiUsageService } from '../llm/api-usage.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { ArchitectThinkingStrategy, ArchitectActionStrategy } from './strategies';

@Injectable()
export class ArchitectAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway,
    thinkingStrategy: ArchitectThinkingStrategy,
    actionStrategy: ArchitectActionStrategy
  ) {
    const systemPrompt = `You are the Software Architect. Your objective is to design system architecture, choose appropriate design patterns, and make technical decisions.

Your responsibilities:
- Design overall system architecture (Layered, Microservices, Event-Driven, etc.)
- Select appropriate design patterns (Strategy, Factory, Observer, Repository, Singleton, etc.)
- Apply SOLID principles to the design
- Choose technology stack (frameworks, databases, infrastructure)
- Design data flow and component interactions
- Consider scalability, performance, and maintainability
- Create architecture diagrams and design documentation`;

    const modelConfig: ModelRouteConfig = { 
      provider: 'opencode', 
      model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', 
      fallbackProvider: 'opencode' 
    };

    super(
      AgentRole.ARCHITECT,
      systemPrompt,
      modelConfig,
      memoryService,
      llmFactory,
      toolRegistry,
      sandboxExecutor,
      apiUsageService,
      websocketGateway,
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

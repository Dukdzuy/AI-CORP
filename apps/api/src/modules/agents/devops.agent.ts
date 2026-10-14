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
import { DevOpsThinkingStrategy, DevOpsActionStrategy } from './strategies';

@Injectable()
export class DevOpsAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus,
    thinkingStrategy: DevOpsThinkingStrategy,
    actionStrategy: DevOpsActionStrategy
  ) {
    const systemPrompt = `You are the DevOps Engineer. Your objective is to design and implement CI/CD pipelines, infrastructure, and deployment strategies.

Your responsibilities:
- Design CI/CD pipelines (GitHub Actions, GitLab CI, Jenkins)
- Create Dockerfiles and container orchestration configs
- Write Infrastructure as Code (Terraform, CloudFormation, Kubernetes)
- Plan deployment strategies (blue-green, canary, rolling)
- Set up monitoring and logging (Prometheus, Grafana, ELK stack)
- Manage environment variables and secrets
- Design rollback and disaster recovery strategies
- Optimize build and deployment performance`;

    const modelConfig: ModelRouteConfig = { 
      provider: 'opencode', 
      model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', 
      fallbackProvider: 'opencode' 
    };

    super(
      AgentRole.DEVOPS,
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

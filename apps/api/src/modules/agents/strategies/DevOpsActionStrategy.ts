import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';

@Injectable()
export class DevOpsActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(DevOpsActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant DevOps patterns:\n${memories.join('\n')}`
      : '';

    const goal = context.goal || context.projectContext?.goal || '';
    const description = context.projectContext?.description || '';
    const architecture = context.architecture || '';

    const systemPrompt = `You are a DevOps Engineer. Design the complete deployment and infrastructure strategy.`;

    const prompt = `You are a DevOps Engineer. Design the complete deployment and infrastructure strategy.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}
${architecture ? `ARCHITECTURE:\n${architecture}\n` : ''}
${memoryContext}

Create comprehensive DevOps documentation:

1. DOCKERFILE
   - Multi-stage build if applicable
   - Optimized for production
   - Include necessary dependencies

2. CI/CD PIPELINE (GitHub Actions or GitLab CI)
   - Build and test stages
   - Deployment stages (dev, staging, prod)
   - Automated testing integration

3. INFRASTRUCTURE AS CODE
   - Choose tool (Terraform, CloudFormation, Kubernetes manifests)
   - Define resources: compute, storage, networking
   - Environment variables and secrets management

4. DEPLOYMENT STRATEGY
   - Blue-green, canary, or rolling deployment
   - Rollback strategy
   - Health checks and monitoring

5. MONITORING & LOGGING
   - Application monitoring (Prometheus, Grafana)
   - Centralized logging (ELK stack)
   - Alerting rules

Provide actual configuration files where possible (Dockerfile, .gitlab-ci.yml, etc.).`;

    // Fetch latest model config
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', fallbackProvider: 'opencode' };
    const actualModelConfig = await this.memoryService.getModelConfigForAgent(AgentRole.DEVOPS, modelConfig);
    const provider = this.llmFactory.getProvider(actualModelConfig);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: actualModelConfig.model,
      maxTokens: 2000
    });

    // Save memory
    const agentId = await this.memoryService.getAgentIdByRole(AgentRole.DEVOPS);
    if (agentId) {
      await this.memoryService.saveMemory(
        agentId,
        AgentRole.DEVOPS,
        'devops_patterns',
        `Designed DevOps strategy for: ${goal}`,
        { importance: 8, projectId: context.projectId }
      );
    }

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId || 'unknown', {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.DEVOPS,
        agentRole: AgentRole.DEVOPS,
        taskId: context.taskId || 'none',
        actionType: 'designDevOps',
        toolName: 'llm',
        parameters: { goal }
      }
    });

    return {
      success: true,
      output: { action: 'designDevOps', output: result.content },
      errors: []
    };
  }
}

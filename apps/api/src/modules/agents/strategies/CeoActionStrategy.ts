import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';

@Injectable()
export class CeoActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(CeoActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const goal = context.projectContext?.goal || context.goal || '';
    const description = context.projectContext?.description || '';
    
    const systemPrompt = `You are the CEO. Your objective is to define the strategic vision, plan high-level milestones, and ensure the product aligns with market needs.`;
    
    const prompt = `You are the CEO planning a project.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}

Create 2-4 high-level milestones for this project. Each milestone should be a clear, deliverable objective.

Format your response as a numbered list:
1. Milestone name - Brief description of what will be delivered
2. Milestone name - Brief description of what will be delivered
3. Milestone name - Brief description of what will be delivered

Be specific and actionable. Each milestone should be completable in a reasonable timeframe.`;

    // Fetch latest model config
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/openrouter/free', fallbackProvider: 'opencode' };
    const actualModelConfig = await this.memoryService.getModelConfigForAgent(AgentRole.CEO, modelConfig);
    const provider = this.llmFactory.getProvider(actualModelConfig);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: actualModelConfig.model,
      maxTokens: 1000
    });

    // Save memory
    const agentId = await this.memoryService.getAgentIdByRole(AgentRole.CEO);
    if (agentId) {
      await this.memoryService.saveMemory(
        agentId,
        AgentRole.CEO,
        'strategy',
        `Created milestones for goal: ${goal}`,
        { importance: 8, projectId: context.projectId }
      );
    }

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId || 'unknown', {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.CEO,
        agentRole: AgentRole.CEO,
        taskId: context.taskId || 'none',
        actionType: 'planMilestones',
        toolName: 'llm',
        parameters: { goal }
      }
    });

    return {
      success: true,
      output: { action: 'planMilestones', output: result.content },
      errors: []
    };
  }
}

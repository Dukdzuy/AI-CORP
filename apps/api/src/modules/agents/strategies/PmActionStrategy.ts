import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';

@Injectable()
export class PmActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(PmActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly systemPrompt: string,
    private readonly modelConfig: ModelRouteConfig
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant past learnings:\n${memories.join('\n')}`
      : '';

    const goal = context.goal || context.projectContext?.goal || '';
    const milestone = context.milestone || '';

    const prompt = `You are the Project Manager breaking down milestones into developer tasks.

PROJECT GOAL: ${goal}
MILESTONE: ${milestone}
${memoryContext}

Create 2-4 specific, actionable tasks for developers. Each task should be clear enough for a developer to implement.

Format your response as a numbered list:
1. Task title - Brief description of what needs to be done
2. Task title - Brief description of what needs to be done
3. Task title - Brief description of what needs to be done

Each task should be specific, measurable, and achievable.`;

    // Fetch latest model config
    const modelConfig = await this.memoryService.getModelConfigForAgent(AgentRole.PM, this.modelConfig);
    const provider = this.llmFactory.getProvider(modelConfig);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: modelConfig.model,
      maxTokens: 800
    });

    // Save memory
    await this.memoryService.saveMemory(
      await this.memoryService.getAgentIdByRole(AgentRole.PM) || 'pm',
      AgentRole.PM,
      'task_breakdown',
      `Broke down milestone: ${milestone}`,
      { importance: 6, projectId: context.projectId }
    );

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId, {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.PM,
        agentRole: AgentRole.PM,
        taskId: context.taskId || 'none',
        actionType: 'breakdownTasks',
        toolName: 'llm',
        parameters: { milestone: context.milestone }
      }
    });

    return {
      success: true,
      output: { action: 'breakdownTasks', output: result.content },
    };
  }
}

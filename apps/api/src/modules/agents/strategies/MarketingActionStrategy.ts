import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentLLMService } from '../services/agent-llm.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';

@Injectable()
export class MarketingActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(MarketingActionStrategy.name);
  private readonly systemPrompt = 'You are the Marketing Manager. Your objective is to draft announcements, blog posts, and prepare launch materials.';
  private readonly modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/openrouter/owl-alpha', fallbackProvider: 'opencode' };

  constructor(
    private readonly memoryService: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant brand voice:\n${memories.join('\n')}`
      : '';

    const goal = context.goal || context.projectContext?.goal || '';
    const projectSummary = context.projectSummary || context.projectContext?.description || '';

    const prompt = `You are the Marketing Manager drafting a release announcement.

PROJECT: ${projectSummary}
GOAL: ${goal}
${memoryContext}

Write a professional release announcement that:
1. Highlights the key features and benefits
2. Explains what problem it solves
3. Includes a call-to-action
4. Is concise but compelling (2-3 paragraphs)

Target audience: Internal stakeholders and potential users.`;

    // Fetch latest model config
    const { provider, model } = await this.agentLLM.providerFor(AgentRole.MARKETING, this.modelConfig, context.projectId);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 800
    });

    // Save memory
    await this.memoryService.saveMemory(
      await this.memoryService.getAgentIdByRole(AgentRole.MARKETING) || 'marketing',
      AgentRole.MARKETING,
      'brand_voice',
      `Drafted announcement for: ${projectSummary}`,
      { importance: 5, projectId: context.projectId }
    );

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId, {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.MARKETING,
        agentRole: AgentRole.MARKETING,
        taskId: context.taskId || 'none',
        actionType: 'draftAnnouncement',
        toolName: 'llm',
        parameters: { projectSummary }
      }
    });

    return {
      success: true,
      output: { action: 'draftAnnouncement', output: result.content },
    };
  }
}

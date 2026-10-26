import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentLLMService } from '../services/agent-llm.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { MarketingOutput } from '../../../domain/agent/AgentOutputs';
import { MARKETING_PROFILE } from '../profiles';

@Injectable()
export class MarketingActionStrategy implements IActionStrategy<MarketingOutput> {
  private readonly logger = new Logger(MarketingActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult<MarketingOutput>> {
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

    const { provider, model, systemPrompt } = await this.agentLLM.providerFor(MARKETING_PROFILE, context.projectId);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 800
    });

    // Save memory
    await this.memoryService.saveMemory(
      await this.memoryService.getAgentIdByRole(MARKETING_PROFILE.role) || 'marketing',
      MARKETING_PROFILE.role,
      MARKETING_PROFILE.primaryNamespace,
      `Drafted announcement for: ${projectSummary}`,
      { importance: 5, projectId: context.projectId }
    );

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId, {
      type: 'agent:action',
      payload: {
        agentId: MARKETING_PROFILE.role,
        agentRole: MARKETING_PROFILE.role,
        taskId: context.taskId || 'none',
        actionType: 'draftAnnouncement',
        toolName: 'llm',
        parameters: { projectSummary }
      }
    });

    return {
      success: true,
      output: { action: 'draftAnnouncement', output: result.content || '' },
    };
  }
}

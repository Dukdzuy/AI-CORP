import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';

@Injectable()
export class BAActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(BAActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant requirements patterns:\n${memories.join('\n')}`
      : '';

    const goal = context.goal || context.projectContext?.goal || '';
    const description = context.projectContext?.description || '';

    const systemPrompt = `You are a Business Analyst. Analyze the project and create detailed requirements documentation.`;

    const prompt = `You are a Business Analyst. Analyze the project and create detailed requirements documentation.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}
${memoryContext}

Create a comprehensive requirements document with:

1. USER STORIES (Format: As a [role], I want [feature], so that [benefit])
   - Write 3-5 user stories covering key functionality

2. FUNCTIONAL REQUIREMENTS
   - List 5-7 specific functional requirements
   - Each should be clear, testable, and measurable

3. NON-FUNCTIONAL REQUIREMENTS
   - Performance (response time, throughput)
   - Security (authentication, authorization)
   - Scalability (concurrent users, data volume)
   - Usability (accessibility, user experience)

Format your response clearly with headings and bullet points.`;

    // Fetch latest model config
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/openrouter/free', fallbackProvider: 'opencode' };
    const actualModelConfig = await this.memoryService.getModelConfigForAgent(AgentRole.BA, modelConfig);
    const provider = this.llmFactory.getProvider(actualModelConfig);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: actualModelConfig.model,
      maxTokens: 1500
    });

    // Save memory
    const agentId = await this.memoryService.getAgentIdByRole(AgentRole.BA);
    if (agentId) {
      await this.memoryService.saveMemory(
        agentId,
        AgentRole.BA,
        'requirements_analysis',
        `Analyzed requirements for: ${goal}`,
        { importance: 7, projectId: context.projectId }
      );
    }

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId || 'unknown', {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.BA,
        agentRole: AgentRole.BA,
        taskId: context.taskId || 'none',
        actionType: 'analyzeRequirements',
        toolName: 'llm',
        parameters: { goal }
      }
    });

    return {
      success: true,
      output: { action: 'analyzeRequirements', output: result.content },
      errors: []
    };
  }
}

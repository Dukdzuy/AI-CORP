import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';

@Injectable()
export class ArchitectActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(ArchitectActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant architecture patterns:\n${memories.join('\n')}`
      : '';

    const goal = context.goal || context.projectContext?.goal || '';
    const description = context.projectContext?.description || '';
    const requirements = context.requirements || '';

    const systemPrompt = `You are a Software Architect. Design a comprehensive system architecture.`;

    const prompt = `You are a Software Architect. Design a comprehensive system architecture.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}
${requirements ? `REQUIREMENTS:\n${requirements}\n` : ''}
${memoryContext}

Create a detailed architecture design document:

1. SYSTEM ARCHITECTURE
   - Choose architecture style (Layered, Microservices, Event-Driven, etc.)
   - Justify the choice based on requirements
   - Describe major system components and their responsibilities

2. DESIGN PATTERNS
   - Identify applicable GoF patterns (Strategy, Factory, Observer, Repository, etc.)
   - Explain where and why each pattern will be used
   - Consider SOLID principles in the design

3. TECHNOLOGY STACK
   - Backend framework and language
   - Database (SQL vs NoSQL, justify choice)
   - Frontend framework
   - Infrastructure (cloud, containerization)

4. DATA FLOW & COMPONENT DIAGRAM (text-based)
   - Describe how data flows through the system
   - Show key components and their interactions

5. SCALABILITY & PERFORMANCE CONSIDERATIONS
   - Caching strategy
   - Load balancing
   - Database optimization

Format with clear headings and bullet points.`;

    // Fetch latest model config
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', fallbackProvider: 'opencode' };
    const actualModelConfig = await this.memoryService.getModelConfigForAgent(AgentRole.ARCHITECT, modelConfig);
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
    const agentId = await this.memoryService.getAgentIdByRole(AgentRole.ARCHITECT);
    if (agentId) {
      await this.memoryService.saveMemory(
        agentId,
        AgentRole.ARCHITECT,
        'architecture_patterns',
        `Designed architecture for: ${goal}`,
        { importance: 9, projectId: context.projectId }
      );
    }

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId || 'unknown', {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.ARCHITECT,
        agentRole: AgentRole.ARCHITECT,
        taskId: context.taskId || 'none',
        actionType: 'designArchitecture',
        toolName: 'llm',
        parameters: { goal }
      }
    });

    return {
      success: true,
      output: { action: 'designArchitecture', output: result.content },
      errors: []
    };
  }
}

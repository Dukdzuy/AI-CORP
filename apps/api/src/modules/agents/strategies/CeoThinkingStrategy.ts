import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { AgentRole } from '@ai-corp/shared-types';

@Injectable()
export class CeoThinkingStrategy implements IThinkingStrategy {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory
  ) {}

  async think(context: AgentContext): Promise<AgentThought> {
    const goal = context.projectContext?.goal || context.goal || '';
    
    // Load relevant strategic memories
    const memories = await this.memoryService.searchMemories(
      AgentRole.CEO,
      'strategy',
      goal,
      3
    );

    const reasoning = 'Analyzing project goals to formulate milestones.';

    return {
      reasoning,
      plannedActions: [
        {
          toolName: 'llm',
          parameters: {},
          rationale: 'Generate 2-4 strategic milestones'
        }
      ],
      confidence: 0.9,
      memories: memories.map(m => m.content)
    };
  }
}

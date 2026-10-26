import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentRole } from '@ai-corp/shared-types';

@Injectable()
export class QaThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    // Load testing patterns memories
    const memories = await this.memoryService.searchMemories(
      AgentRole.QA,
      'testing_patterns',
      JSON.stringify(context),
      5
    );

    const reasoning = 'Planning testing strategy for the provided code.';

    return {
      reasoning,
      plannedActions: [
        {
          toolName: 'llm',
          parameters: {},
          rationale: 'Review code and determine PASS/FAIL verdict'
        }
      ],
      confidence: 0.9,
      memories: memories.map(m => m.content)
    };
  }
}

import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { BA_PROFILE } from '../profiles';

@Injectable()
export class BAThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    // Load requirements analysis memories
    const memories = await this.memoryService.searchMemories(
      BA_PROFILE.role,
      BA_PROFILE.primaryNamespace,
      JSON.stringify(context),
      5
    );

    const reasoning = 'Analyzing project requirements to extract user stories and functional specifications.';

    return {
      reasoning,
      plannedActions: [
        {
          toolName: 'llm',
          parameters: {},
          rationale: 'Generate user stories (As a...I want...So that...) and functional requirements'
        }
      ],
      confidence: 0.88,
      memories: memories.map(m => m.content)
    };
  }
}

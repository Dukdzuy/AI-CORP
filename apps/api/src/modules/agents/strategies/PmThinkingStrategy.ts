import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { PM_PROFILE } from '../profiles';

@Injectable()
export class PmThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    // Load lessons_learned, then task breakdown memories
    const memories = await this.memoryService.recall(
      PM_PROFILE.role,
      PM_PROFILE.primaryNamespace,
      JSON.stringify(context),
      5
    );

    const reasoning = 'Turning the approved use cases into developer tasks, one per use case.';

    return {
      reasoning,
      plannedActions: [
        {
          toolName: 'llm',
          parameters: {},
          rationale: 'Generate one actionable developer task per use case'
        }
      ],
      confidence: 0.85,
      memories
    };
  }
}

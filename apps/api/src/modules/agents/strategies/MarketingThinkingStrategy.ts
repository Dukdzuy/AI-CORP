import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { MARKETING_PROFILE } from '../profiles';

@Injectable()
export class MarketingThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    // Load lessons_learned, then brand voice memories
    const memories = await this.memoryService.recall(
      MARKETING_PROFILE.role,
      MARKETING_PROFILE.primaryNamespace,
      JSON.stringify(context),
      5
    );

    const reasoning = 'Formulating go-to-market messaging for the new features.';

    return {
      reasoning,
      plannedActions: [
        {
          toolName: 'llm',
          parameters: {},
          rationale: 'Draft compelling release announcement'
        }
      ],
      confidence: 0.85,
      memories
    };
  }
}

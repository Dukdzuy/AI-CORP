import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { QA_PROFILE } from '../profiles';

@Injectable()
export class QaThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    // Load lessons_learned, then review checklist memories (same namespace QaActionStrategy saves to)
    const memories = await this.memoryService.recall(
      QA_PROFILE.role,
      QA_PROFILE.primaryNamespace,
      JSON.stringify(context),
      5
    );

    const reasoning = 'Reviewing the implementation against the approved OOAD design and the QC report.';

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
      memories
    };
  }
}

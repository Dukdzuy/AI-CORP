import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { QC_PROFILE } from '../profiles';

@Injectable()
export class QcThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    const memories = await this.memoryService.recall(
      QC_PROFILE.role,
      QC_PROFILE.primaryNamespace,
      context.goal || context.task || '',
      5
    );

    return {
      reasoning: 'Deriving acceptance tests from the use cases and checking which use cases the implementation covers.',
      plannedActions: [
        {
          toolName: 'llm',
          parameters: {},
          rationale: 'Write one acceptance test suite per use case (main, alternative and exception flows)',
        },
        {
          toolName: 'traceability',
          parameters: {},
          rationale: 'Map use cases to domain classes, implementation files and tests; compute coverage',
        },
      ],
      confidence: 0.85,
      memories,
    };
  }
}

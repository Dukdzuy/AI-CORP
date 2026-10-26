import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { CEO_PROFILE } from '../profiles';

@Injectable()
export class CeoThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    const goal = context.projectContext?.goal || context.goal || '';
    const completing = context.taskType === 'complete_project';

    // Load lessons_learned, then relevant strategic memories
    const memories = await this.memoryService.recall(
      CEO_PROFILE.role,
      CEO_PROFILE.primaryNamespace,
      goal,
      3
    );

    const reasoning = completing
      ? 'Reviewing what was delivered against the project goal to close the project.'
      : 'Analyzing project goals to formulate milestones.';

    return {
      reasoning,
      plannedActions: [
        {
          toolName: 'llm',
          parameters: {},
          rationale: completing ? 'Write the project close-out report' : 'Generate 2-4 strategic milestones'
        }
      ],
      confidence: 0.9,
      memories
    };
  }
}

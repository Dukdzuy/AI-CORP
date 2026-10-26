import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { DEV_PROFILE } from '../profiles';

@Injectable()
export class DevThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    // Load lessons_learned, then coding conventions memories
    const memories = await this.memoryService.recall(
      DEV_PROFILE.role,
      DEV_PROFILE.primaryNamespace,
      JSON.stringify(context),
      5
    );

    const goal = context.goal || context.projectContext?.goal || '';
    const reasoning = `Analyzing implementation requirements for: ${goal || context.task}`;

    return {
      reasoning,
      plannedActions: [
        {
          toolName: 'write_file',
          parameters: {},
          rationale: 'Generate complete, working code files'
        }
      ],
      confidence: 0.8,
      memories
    };
  }
}

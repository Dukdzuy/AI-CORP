import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentRole } from '@ai-corp/shared-types';

@Injectable()
export class DevThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    // Load coding conventions memories
    const memories = await this.memoryService.searchMemories(
      AgentRole.DEV,
      'coding_conventions',
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
      memories: memories.map(m => m.content)
    };
  }
}

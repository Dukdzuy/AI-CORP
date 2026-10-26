import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentRole } from '@ai-corp/shared-types';

@Injectable()
export class PmThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    // Load task breakdown memories
    const memories = await this.memoryService.searchMemories(
      AgentRole.PM,
      'task_breakdown',
      JSON.stringify(context),
      5
    );

    const reasoning = 'Breaking down CEO milestones into developer tasks.';

    return {
      reasoning,
      plannedActions: [
        {
          toolName: 'llm',
          parameters: {},
          rationale: 'Generate 2-4 actionable developer tasks'
        }
      ],
      confidence: 0.85,
      memories: memories.map(m => m.content)
    };
  }
}

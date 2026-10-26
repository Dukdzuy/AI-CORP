import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentRole } from '@ai-corp/shared-types';

@Injectable()
export class DevOpsThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    // Load DevOps patterns memories
    const memories = await this.memoryService.searchMemories(
      AgentRole.DEVOPS,
      'devops_patterns',
      JSON.stringify(context),
      5
    );

    const reasoning = 'Analyzing system to design CI/CD pipeline, infrastructure, and deployment strategy.';

    return {
      reasoning,
      plannedActions: [
        {
          toolName: 'llm',
          parameters: {},
          rationale: 'Generate deployment configs, Dockerfiles, CI/CD pipeline definitions'
        }
      ],
      confidence: 0.87,
      memories: memories.map(m => m.content)
    };
  }
}

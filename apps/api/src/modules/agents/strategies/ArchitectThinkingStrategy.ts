import { Injectable } from '@nestjs/common';
import { IThinkingStrategy } from '../../../domain/agent/interfaces/IThinkingStrategy.interface';
import { AgentContext, AgentThought } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentRole } from '@ai-corp/shared-types';

@Injectable()
export class ArchitectThinkingStrategy implements IThinkingStrategy {
  constructor(private readonly memoryService: MemoryService) {}

  async think(context: AgentContext): Promise<AgentThought> {
    // Load architecture patterns memories
    const memories = await this.memoryService.searchMemories(
      AgentRole.ARCHITECT,
      'architecture_patterns',
      JSON.stringify(context),
      5
    );

    const reasoning = 'Analyzing system requirements to design architecture and select appropriate design patterns.';

    return {
      reasoning,
      plannedActions: [
        {
          toolName: 'llm',
          parameters: {},
          expectedOutcome: 'Design system architecture, choose patterns (MVC, Microservices, Layered, etc.)'
        }
      ],
      confidence: 0.92,
      memories: memories.map(m => m.content)
    };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentLLMService } from '../services/agent-llm.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { PmOutput } from '../../../domain/agent/AgentOutputs';
import { PM_PROFILE } from '../profiles';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class PmActionStrategy implements IActionStrategy<PmOutput> {
  private readonly logger = new Logger(PmActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly prisma: PrismaService
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult<PmOutput>> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant past learnings:\n${memories.join('\n')}`
      : '';

    const goal = context.goal || context.projectContext?.goal || '';
    const milestone = context.milestone || '';
    const useCases = await this.loadUseCases(context.projectId);

    // PM runs after BA/Architect: tasks are derived from the approved use cases (one task per use case)
    const prompt = useCases.length > 0
      ? `You are the Project Manager planning the implementation of an approved design.

PROJECT GOAL: ${goal}
${milestone ? `MILESTONE: ${milestone}\n` : ''}USE CASES (approved by the OOAD quality gate):
${useCases.map(uc => `- ${uc.id}: ${uc.name} (priority ${uc.priority})`).join('\n')}
${memoryContext}

Create one developer task per use case, ordered by priority. Keep the use case id at the start of each title.

Format your response as a numbered list:
1. UC-001 Task title - Brief description of what needs to be done
2. UC-002 Task title - Brief description of what needs to be done

Each task should be specific, measurable, and achievable.`
      : `You are the Project Manager breaking down milestones into developer tasks.

PROJECT GOAL: ${goal}
MILESTONE: ${milestone}
${memoryContext}

Create 2-4 specific, actionable tasks for developers. Each task should be clear enough for a developer to implement.

Format your response as a numbered list:
1. Task title - Brief description of what needs to be done
2. Task title - Brief description of what needs to be done
3. Task title - Brief description of what needs to be done

Each task should be specific, measurable, and achievable.`;

    const { provider, model, systemPrompt } = await this.agentLLM.providerFor(PM_PROFILE, context.projectId);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ],
      model,
      maxTokens: 1200
    });

    // Save memory
    await this.memoryService.saveMemory(
      await this.memoryService.getAgentIdByRole(PM_PROFILE.role) || 'pm',
      PM_PROFILE.role,
      PM_PROFILE.primaryNamespace,
      useCases.length > 0 ? `Planned ${useCases.length} use case tasks for: ${goal}` : `Broke down milestone: ${milestone}`,
      { importance: 6, projectId: context.projectId }
    );

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId, {
      type: 'agent:action',
      payload: {
        agentId: PM_PROFILE.role,
        agentRole: PM_PROFILE.role,
        taskId: context.taskId || 'none',
        actionType: 'breakdownTasks',
        toolName: 'llm',
        parameters: { milestone: context.milestone }
      }
    });

    return {
      success: true,
      output: { action: 'breakdownTasks', output: result.content || '' },
    };
  }

  private async loadUseCases(projectId?: string): Promise<Array<{ id: string; name: string; priority: string }>> {
    if (!projectId || projectId === 'unknown') return [];
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: { ooadMetadata: true }
    });
    const useCases = ((project?.ooadMetadata as any)?.useCases || []) as Array<{ id: string; name: string; priority: string }>;
    const rank: Record<string, number> = { High: 0, Medium: 1, Low: 2 };
    return [...useCases].sort((a, b) => (rank[a.priority] ?? 3) - (rank[b.priority] ?? 3));
  }
}

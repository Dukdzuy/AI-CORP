import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { AgentLLMService } from '../services/agent-llm.service';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { CeoOutput } from '../../../domain/agent/AgentOutputs';
import { CEO_PROFILE } from '../profiles';

@Injectable()
export class CeoActionStrategy implements IActionStrategy<CeoOutput> {
  private readonly logger = new Logger(CeoActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult<CeoOutput>> {
    const goal = context.projectContext?.goal || context.goal || '';
    const description = context.projectContext?.description || '';
    
    // The CEO opens the workflow (milestone plan) and closes it (project wrap-up)
    const completing = context.taskType === 'complete_project';
    const actionName: CeoOutput['action'] = completing ? 'complete_project' : 'planMilestones';

    const prompt = completing
      ? `You are the CEO closing a project.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}

Write a short project close-out report: what was delivered, how it maps to the original goal, open risks and lessons learned for the next project.`
      : `You are the CEO planning a project.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}

Create 2-4 high-level milestones for this project. Each milestone should be a clear, deliverable objective.

Format your response as a numbered list:
1. Milestone name - Brief description of what will be delivered
2. Milestone name - Brief description of what will be delivered
3. Milestone name - Brief description of what will be delivered

Be specific and actionable. Each milestone should be completable in a reasonable timeframe.`;

    const memoryContext = thought.memories?.length ? `\n\nPast strategic decisions:\n${thought.memories.join('\n')}` : '';
    const { provider, model, systemPrompt } = await this.agentLLM.providerFor(CEO_PROFILE, context.projectId);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt + memoryContext }
      ],
      model,
      maxTokens: 1000
    });

    // Save memory
    const agentId = await this.memoryService.getAgentIdByRole(CEO_PROFILE.role);
    if (agentId) {
      await this.memoryService.saveMemory(
        agentId,
        CEO_PROFILE.role,
        CEO_PROFILE.primaryNamespace,
        completing ? `Closed project: ${goal}` : `Created milestones for goal: ${goal}`,
        { importance: 8, projectId: context.projectId }
      );
    }

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId || 'unknown', {
      type: 'agent:action',
      payload: {
        agentId: CEO_PROFILE.role,
        agentRole: CEO_PROFILE.role,
        taskId: context.taskId || 'none',
        actionType: actionName,
        toolName: 'llm',
        parameters: { goal }
      }
    });

    return {
      success: true,
      output: { action: actionName, output: result.content || '' },
    };
  }
}

import { Inject, Injectable, Logger } from '@nestjs/common';
import { AgentContext as SharedAgentContext } from '@ai-corp/shared-types';
import { IAgent } from '../../domain/agent/interfaces/IAgent.interface';
import { AgentContext, AgentResult } from '../../domain/common/types';
import { AGENTS } from '../agents/agents.registry';
import { AgentMessageBus } from './agent-message.bus';
import { Performative } from '../../domain/collaboration/AclMessage';

/**
 * AgentOrchestratorService
 *
 * Looks up the agent for a role and runs it. The registry is built from the AGENTS token,
 * so the orchestrator depends only on the IAgent abstraction: adding a role does not touch
 * this class (Open/Closed Principle).
 *
 * @pattern Registry, Dependency Inversion
 */
@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);
  private readonly agentRegistry = new Map<string, IAgent>();

  constructor(
    @Inject(AGENTS) agents: IAgent[],
    private readonly messageBus: AgentMessageBus,
  ) {
    for (const agent of agents) {
      const role = agent.getRole();
      if (this.agentRegistry.has(role)) {
        throw new Error(`Duplicate agent registered for role ${role}`);
      }
      this.agentRegistry.set(role, agent);
    }
  }

  /**
   * Invokes the agent registered for the role with the given context.
   */
  async invokeAgent(role: string, context: AgentContext | SharedAgentContext): Promise<AgentResult> {
    this.logger.log(`Invoking agent [${role}] for project ${context.projectId}`);

    const agent = this.agentRegistry.get(role);
    if (!agent) {
      throw new Error(`Unsupported agent role: ${role}. Available roles: ${this.getAvailableRoles().join(', ')}`);
    }

    // Agent runs its think → act cycle
    const result = await agent.execute(context as AgentContext);

    // Tell the team what was done: one INFORM through the message bus (Mediator).
    // Collaboration turns are skipped: their pattern already reports them as ACL messages.
    if (result.action && !(context as AgentContext).collaboration) {
      try {
        await this.messageBus.send({
          performative: Performative.INFORM,
          sender: role,
          receiver: 'all',
          content: AgentOrchestratorService.summarize(result.action),
          projectId: context.projectId || 'unknown_project',
          conversationId: context.workflowRunId || context.taskId || `${role}-${Date.now()}`,
          protocol: 'task_result',
        });
      } catch (err: any) {
        this.logger.warn(`Could not announce ${role}'s result: ${err.message}`);
      }
    }

    return result;
  }

  /** One readable line for the Meeting Room: the task type and the first line of the result */
  static summarize(action: any): string {
    const payload = action && typeof action === 'object' && typeof action.success === 'boolean'
      ? action.output
      : action;
    if (!payload || typeof payload !== 'object') {
      return `Completed the task: ${String(payload ?? '').slice(0, 200) || 'no output'}`;
    }
    const detail = [payload.toolOutput, payload.output]
      .find(v => typeof v === 'string' && v.trim())
      ?.trim().split('\n').find((line: string) => line.trim())?.trim() || 'done';
    const clipped = detail.length > 200 ? `${detail.slice(0, 197)}...` : detail;
    return `Completed ${payload.action || 'the task'}: ${clipped}`;
  }

  /**
   * Get all registered agent roles
   */
  getAvailableRoles(): string[] {
    return Array.from(this.agentRegistry.keys());
  }

  /**
   * Check if an agent role is registered
   */
  hasAgent(role: string): boolean {
    return this.agentRegistry.has(role);
  }
}

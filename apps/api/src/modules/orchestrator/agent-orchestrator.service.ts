import { Inject, Injectable, Logger } from '@nestjs/common';
import { AgentContext as SharedAgentContext } from '@ai-corp/shared-types';
import { IAgent } from '../../domain/agent/interfaces/IAgent.interface';
import { AgentContext, AgentResult } from '../../domain/common/types';
import { AGENTS } from '../agents/agents.registry';
import { AgentMessageService } from './agent-message.service';

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
    private readonly messageService: AgentMessageService,
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

    // Broadcast a summary message from the agent to the project
    if (result.action) {
      await this.messageService.sendMessage({
        projectId: context.projectId || 'unknown_project',
        fromRole: role,
        message: `I have completed the task. Action taken: ${JSON.stringify(result.action)}`,
        messageType: 'action',
        metadata: {
          taskId: context.taskId,
          action: result.action,
        }
      });
    }

    return result;
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

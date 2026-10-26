import { Injectable, Logger } from '@nestjs/common';
import { CeoAgent } from '../agents/ceo.agent';
import { PmAgent } from '../agents/pm.agent';
import { DevAgent } from '../agents/dev.agent';
import { QaAgent } from '../agents/qa.agent';
import { MarketingAgent } from '../agents/marketing.agent';
import { BaAgent } from '../agents/ba.agent';
import { ArchitectAgent } from '../agents/architect.agent';
import { QcAgent } from '../agents/qc.agent';
import { BaseAgent } from '../agents/base.agent';
import { AgentRole, AgentContext } from '@ai-corp/shared-types';
import { AgentMessageService } from './agent-message.service';

/**
 * AgentOrchestratorService
 * 
 * Implements the Registry Pattern to manage agent instances.
 * Replaces switch statement with Map-based registry for better extensibility.
 * 
 * Design Pattern: **Registry Pattern**
 * Benefits:
 * - Open/Closed Principle: Add new agents without modifying this class
 * - Single point of agent management
 * - Type-safe agent lookup
 * - Easy to test and mock
 */
@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);
  private readonly agentRegistry: Map<string, BaseAgent>;

  constructor(
    private readonly ceoAgent: CeoAgent,
    private readonly pmAgent: PmAgent,
    private readonly devAgent: DevAgent,
    private readonly qaAgent: QaAgent,
    private readonly marketingAgent: MarketingAgent,
    private readonly baAgent: BaAgent,
    private readonly architectAgent: ArchitectAgent,
    private readonly qcAgent: QcAgent,
    private readonly messageService: AgentMessageService,
  ) {
    // Initialize agent registry - Map-based lookup instead of switch statement
    this.agentRegistry = new Map<string, BaseAgent>([
      [AgentRole.CEO, this.ceoAgent],
      [AgentRole.PM, this.pmAgent],
      [AgentRole.DEV, this.devAgent],
      [AgentRole.QA, this.qaAgent],
      [AgentRole.MARKETING, this.marketingAgent],
      [AgentRole.BA, this.baAgent],
      [AgentRole.ARCHITECT, this.architectAgent],
      [AgentRole.QC, this.qcAgent],
    ]);
  }

  /**
   * Invokes the correct agent based on role, providing the required context.
   * Uses Registry Pattern for agent lookup.
   */
  async invokeAgent(role: string, context: AgentContext) {
    this.logger.log(`Invoking agent [${role}] for project ${context.projectId}`);
    
    const agent = this.agentRegistry.get(role);
    if (!agent) {
      throw new Error(`Unsupported agent role: ${role}. Available roles: ${Array.from(this.agentRegistry.keys()).join(', ')}`);
    }

    // Agent executes its internal <think> and <act> loops
    const result = await agent.execute(context);

    // Optionally broadcast a summary message from the agent to the project
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

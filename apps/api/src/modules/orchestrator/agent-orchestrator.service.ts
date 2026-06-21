import { Injectable, Logger } from '@nestjs/common';
import { CeoAgent } from '../agents/ceo.agent';
import { PmAgent } from '../agents/pm.agent';
import { DevAgent } from '../agents/dev.agent';
import { QaAgent } from '../agents/qa.agent';
import { MarketingAgent } from '../agents/marketing.agent';
import { AgentRole, AgentContext } from '@ai-corp/shared-types';
import { AgentMessageService } from './agent-message.service';

@Injectable()
export class AgentOrchestratorService {
  private readonly logger = new Logger(AgentOrchestratorService.name);

  constructor(
    private readonly ceoAgent: CeoAgent,
    private readonly pmAgent: PmAgent,
    private readonly devAgent: DevAgent,
    private readonly qaAgent: QaAgent,
    private readonly marketingAgent: MarketingAgent,
    private readonly messageService: AgentMessageService,
  ) {}

  /**
   * Invokes the correct agent based on role, providing the required context.
   */
  async invokeAgent(role: string, context: AgentContext) {
    this.logger.log(`Invoking agent [${role}] for project ${context.projectId}`);
    
    const agent = this.getAgentByRole(role);
    if (!agent) {
      throw new Error(`Unsupported agent role: ${role}`);
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

  private getAgentByRole(role: string) {
    switch (role) {
      case AgentRole.CEO: return this.ceoAgent;
      case AgentRole.PM: return this.pmAgent;
      case AgentRole.DEV: return this.devAgent;
      case AgentRole.QA: return this.qaAgent;
      case AgentRole.MARKETING: return this.marketingAgent;
      default: return null;
    }
  }
}

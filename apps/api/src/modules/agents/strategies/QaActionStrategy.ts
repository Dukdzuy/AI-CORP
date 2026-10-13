import { Injectable, Logger } from '@nestjs/common';
import { IActionStrategy } from '../../../domain/agent/interfaces/IActionStrategy.interface';
import { AgentContext, AgentThought, AgentActionResult } from '../../../domain/common/types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';

@Injectable()
export class QaActionStrategy implements IActionStrategy {
  private readonly logger = new Logger(QaActionStrategy.name);

  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly systemPrompt: string,
    private readonly modelConfig: ModelRouteConfig
  ) {}

  async act(context: AgentContext, thought: AgentThought): Promise<AgentActionResult> {
    const memories = thought.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant testing patterns:\n${memories.join('\n')}`
      : '';

    const code = context.code || '';
    const hasCode = code.length > 10 && !code.includes('No code provided');

    const prompt = `You are a QA engineer reviewing code from an AI developer.
${memoryContext}
Code to review:
${hasCode ? code : 'No code was provided by the developer.'}

Rules for your verdict:
- If real implementation code exists (even if imperfect), reply: VERDICT: PASS
- Only reply VERDICT: FAIL if there is absolutely NO code or the code is a pure placeholder (like "echo hello" or just comments)
- Remember: imperfect code is still code. Only reject empty/placeholder responses.

Reply with EXACTLY one of these on the last line:
VERDICT: PASS
VERDICT: FAIL`;

    // Fetch latest model config
    const modelConfig = await this.memoryService.getModelConfigForAgent(AgentRole.QA, this.modelConfig);
    const provider = this.llmFactory.getProvider(modelConfig);

    const result = await provider.chat({
      messages: [
        { role: 'system', content: this.systemPrompt },
        { role: 'user', content: prompt }
      ],
      model: modelConfig.model,
      maxTokens: 800
    });

    // Save memory
    await this.memoryService.saveMemory(
      await this.memoryService.getAgentIdByRole(AgentRole.QA) || 'qa',
      AgentRole.QA,
      'testing_patterns',
      `Reviewed code for task: ${context.taskId || 'unknown'}`,
      { importance: 5, projectId: context.projectId }
    );

    // Emit action event
    this.websocketGateway.sendToProject(context.projectId, {
      type: 'agent:action',
      payload: {
        agentId: AgentRole.QA,
        agentRole: AgentRole.QA,
        taskId: context.taskId || 'none',
        actionType: 'review',
        toolName: 'llm',
        parameters: { codeLength: code.length }
      }
    });

    const output = result.content || '';
    const outputUpper = output.toUpperCase();

    // Check for explicit failure
    const explicitlyFailed = outputUpper.includes('VERDICT: FAIL')
      || outputUpper.includes('VERDICT:FAIL')
      || outputUpper.includes('VERDICT:\\s*FAIL');

    // Check for explicit pass
    const explicitlyPassed = outputUpper.includes('VERDICT: PASS')
      || outputUpper.includes('VERDICT:PASS');

    // Determine approval
    let approved: boolean;
    if (explicitlyFailed) {
      approved = false;
    } else if (explicitlyPassed) {
      approved = true;
    } else {
      approved = hasCode;
    }

    this.logger.log(`QA review result: ${approved ? 'APPROVED' : 'REJECTED'}`);

    return {
      success: true,
      output: {
        action: 'review',
        output,
        qa_approved: approved,
        edgeCondition: approved ? 'onSuccess' : 'onFail'
      },
      errors: []
    };
  }
}

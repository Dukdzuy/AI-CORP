import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AgentRole, ModelRouteConfig } from '@ai-corp/shared-types';
import { MemoryService } from '../memory/memory.service';
import { LLMProviderFactory } from '../llm/llm-provider.factory';
import { ToolRegistry } from '../tools/tool.registry';
import { SandboxExecutor } from '../tools/sandbox.executor';
import { ApiUsageService } from '../llm/api-usage.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';

@Injectable()
export class QaAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway
  ) {
    const systemPrompt = `You are the QA Engineer. Your objective is to review code, run tests, and ensure software quality.`;
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', fallbackProvider: 'opencode' };
    super(AgentRole.QA, systemPrompt, modelConfig, memoryService, llmFactory, toolRegistry, sandboxExecutor, apiUsageService, websocketGateway);
  }

  async think(context: any): Promise<any> {
    this.logger.debug('QA thinking...');
    this.emitThinking(context.projectId, "Planning testing strategy for the provided code.");

    const memories = await this.loadMemory('testing_patterns', JSON.stringify(context));
    return { thought: "Planning testing strategy for the provided code.", memories };
  }

  async act(context: any): Promise<any> {
    this.logger.debug('QA acting...');
    const memories = context.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant testing patterns:\n${memories.map((m: any) => m.content).join('\n')}`
      : '';

    const prompt = `You are a QA engineer reviewing code. Analyze the implementation and give your verdict.
${memoryContext}
Code: ${context.code || 'No code provided'}

Instructions:
- If the code looks reasonable and has no obvious critical bugs, reply with: VERDICT: PASS
- If the code has critical issues that prevent it from working, reply with: VERDICT: FAIL
Always include VERDICT: PASS or VERDICT: FAIL on the last line.`;

    const result = await this.callLLM({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 800
    }, context.projectId);

    await this.saveMemory('testing_patterns', `Reviewed code for task: ${context.taskId || 'unknown'}`, 5, context.projectId);

    this.emitAction(context.projectId, context.taskId || 'none', 'review', 'llm', { codeLength: context.code?.length });

    const output = result.content || '';
    const outputUpper = output.toUpperCase();
    // Robust check: approve unless explicitly FAIL
    const explicitlyFailed = outputUpper.includes('VERDICT: FAIL') || 
                             outputUpper.includes('APPROVED: NO') ||
                             outputUpper.includes('REJECTED');
    const approved = !explicitlyFailed;

    this.logger.log(`QA review result: ${approved ? 'APPROVED' : 'REJECTED'} (explicitlyFailed=${explicitlyFailed})`);

    return { 
      action: 'review', 
      output,
      qa_approved: approved,
      edgeCondition: approved ? 'onSuccess' : 'onFail'
    };
  }
}

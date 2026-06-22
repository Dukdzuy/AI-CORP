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
export class DevAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway
  ) {
    const systemPrompt = `You are the Lead Developer. Your objective is to implement tasks by writing code and executing tests.`;
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', fallbackProvider: 'opencode' };
    super(AgentRole.DEV, systemPrompt, modelConfig, memoryService, llmFactory, toolRegistry, sandboxExecutor, apiUsageService, websocketGateway);
  }

  async think(context: any): Promise<any> {
    this.logger.debug('Dev thinking...');
    this.emitThinking(context.projectId, `Analyzing task implementation requirements for: ${context.task}`);

    const memories = await this.loadMemory('coding_conventions', JSON.stringify(context));
    return { thought: `Analyzing task implementation requirements for: ${context.task}`, memories };
  }

  async act(context: any): Promise<any> {
    this.logger.debug('Dev acting...');
    const memories = context.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant coding conventions:\n${memories.map((m: any) => m.content).join('\n')}`
      : '';

    const prompt = `Implement the following task:${memoryContext}\n\nTask: ${context.task}. Reply with the code logic you would write.`;

    const result = await this.callLLM({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1500
    }, context.projectId);

    let toolOutput = '';
    try {
        const sandboxResult = await this.executeTool('write_file', `echo "Executing DEV logic"`);
        toolOutput = sandboxResult.output;
    } catch(err: any) {
        toolOutput = `Sandbox skipped or failed: ${err.message}`;
    }

    await this.saveMemory('coding_conventions', `Implemented task: ${context.task}`, 5, context.projectId);

    this.emitAction(context.projectId, context.taskId || 'none', 'implement', 'write_file', { task: context.task });
    return { action: 'implement', output: result.content, toolOutput };
  }
}

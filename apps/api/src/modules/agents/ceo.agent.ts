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
export class CeoAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway
  ) {
    const systemPrompt = `You are the CEO. Your objective is to define the strategic vision, plan high-level milestones, and ensure the product aligns with market needs.`;
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/openrouter/free', fallbackProvider: 'opencode' };
    super(AgentRole.CEO, systemPrompt, modelConfig, memoryService, llmFactory, toolRegistry, sandboxExecutor, apiUsageService, websocketGateway);
  }

  async think(context: any): Promise<any> {
    this.logger.debug('CEO thinking...');
    const goal = context.projectContext?.goal || context.goal || '';
    this.emitThinking(context.projectId, 'Analyzing project goals to formulate milestones.');
    const memories = await this.loadMemory('strategy', goal, 3);
    return { thought: "Analyzing project goals to formulate milestones.", memories };
  }

  async act(context: any): Promise<any> {
    this.logger.debug('CEO acting...');
    const goal = context.projectContext?.goal || context.goal || '';
    const prompt = `Please plan up to 3 high-level milestones for the following project goal: ${goal}. Return your plan clearly.`;
    
    const result = await this.callLLM({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1000
    }, context.projectId);

    await this.saveMemory('strategy', `Created milestones for goal: ${goal}`, 8, context.projectId);

    this.emitAction(context.projectId, context.taskId || 'none', 'planMilestones', 'llm', { goal });

    return { action: 'planMilestones', output: result.content };
  }
}

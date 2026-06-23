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
    const description = context.projectContext?.description || '';
    const prompt = `You are the CEO planning a project.

PROJECT GOAL: ${goal}
PROJECT DESCRIPTION: ${description}

Create 2-4 high-level milestones for this project. Each milestone should be a clear, deliverable objective.

Format your response as a numbered list:
1. Milestone name - Brief description of what will be delivered
2. Milestone name - Brief description of what will be delivered
3. Milestone name - Brief description of what will be delivered

Be specific and actionable. Each milestone should be completable in a reasonable timeframe.`;
    
    const result = await this.callLLM({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 1000
    }, context.projectId);

    await this.saveMemory('strategy', `Created milestones for goal: ${goal}`, 8, context.projectId);

    this.emitAction(context.projectId, context.taskId || 'none', 'planMilestones', 'llm', { goal });

    return { action: 'planMilestones', output: result.content };
  }
}

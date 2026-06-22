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
export class PmAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway
  ) {
    const systemPrompt = `You are the Project Manager. Your objective is to break down milestones into actionable technical tasks for the development team.`;
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'openrouter/openrouter/free', fallbackProvider: 'opencode' };
    super(AgentRole.PM, systemPrompt, modelConfig, memoryService, llmFactory, toolRegistry, sandboxExecutor, apiUsageService, websocketGateway);
  }

  async think(context: any): Promise<any> {
    this.logger.debug('PM thinking...');
    this.emitThinking(context.projectId, "Breaking down CEO milestones into developer tasks.");

    const memories = await this.loadMemory('task_breakdown', JSON.stringify(context));
    return { thought: "Breaking down CEO milestones into developer tasks.", memories };
  }

  async act(context: any): Promise<any> {
    this.logger.debug('PM acting...');
    const memories = context.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant past learnings:\n${memories.map((m: any) => m.content).join('\n')}`
      : '';

    const prompt = `Break down the following milestone into 2-3 actionable developer tasks:${memoryContext}\n\nMilestone: ${context.milestone}.`;

    const result = await this.callLLM({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 800
    }, context.projectId);

    await this.saveMemory('task_breakdown', `Broke down milestone: ${context.milestone}`, 6, context.projectId);

    this.emitAction(context.projectId, context.taskId || 'none', 'breakdownTasks', 'llm', { milestone: context.milestone });
    return { action: 'breakdownTasks', output: result.content };
  }
}

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
export class MarketingAgent extends BaseAgent {
  constructor(
    memoryService: MemoryService,
    llmFactory: LLMProviderFactory,
    toolRegistry: ToolRegistry,
    sandboxExecutor: SandboxExecutor,
    apiUsageService: ApiUsageService,
    websocketGateway: AppWebSocketGateway
  ) {
    const systemPrompt = `You are the Marketing Manager. Your objective is to draft announcements, blog posts, and prepare launch materials.`;
    const modelConfig: ModelRouteConfig = { provider: 'opencode', model: 'oc/nemotron-3-ultra-free', fallbackProvider: 'opencode' };
    super(AgentRole.MARKETING, systemPrompt, modelConfig, memoryService, llmFactory, toolRegistry, sandboxExecutor, apiUsageService, websocketGateway);
  }

  async think(context: any): Promise<any> {
    this.logger.debug('Marketing thinking...');
    this.emitThinking(context.projectId, "Formulating go-to-market messaging for the new features.");

    const memories = await this.loadMemory('brand_voice', JSON.stringify(context));
    return { thought: "Formulating go-to-market messaging for the new features.", memories };
  }

  async act(context: any): Promise<any> {
    this.logger.debug('Marketing acting...');
    const memories = context.memories || [];
    const memoryContext = memories.length > 0
      ? `\n\nRelevant brand voice:\n${memories.map((m: any) => m.content).join('\n')}`
      : '';

    const prompt = `Draft a short release announcement for the following completed project:${memoryContext}\n\nProject: ${context.projectSummary}`;

    const result = await this.callLLM({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 800
    }, context.projectId);

    await this.saveMemory('brand_voice', `Drafted announcement for: ${context.projectSummary}`, 5, context.projectId);

    this.emitAction(context.projectId, context.taskId || 'none', 'draftAnnouncement', 'llm', { projectSummary: context.projectSummary });
    return { action: 'draftAnnouncement', output: result.content };
  }
}

import { Injectable } from '@nestjs/common';
import { AgentRole, ILLMProvider, ModelRouteConfig } from '@ai-corp/shared-types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { ApiUsageService } from '../../llm/api-usage.service';
import { UsageTrackingLLMProvider } from '../../llm/usage-tracking.provider';

/**
 * AgentLLMService
 *
 * One place where agent strategies get their LLM: resolves the role's model config
 * (the one saved in Agent Settings, or the strategy's default) and returns a provider
 * wrapped in UsageTrackingLLMProvider, so every agent call is costed against its project.
 *
 * @pattern Facade (over MemoryService config lookup + LLMProviderFactory + usage tracking)
 */
@Injectable()
export class AgentLLMService {
  constructor(
    private readonly memoryService: MemoryService,
    private readonly llmFactory: LLMProviderFactory,
    private readonly apiUsageService: ApiUsageService
  ) {}

  async providerFor(
    role: AgentRole,
    defaults: ModelRouteConfig,
    projectId?: string
  ): Promise<{ provider: ILLMProvider; model: string }> {
    const config: ModelRouteConfig = await this.memoryService.getModelConfigForAgent(role, defaults);
    const provider = new UsageTrackingLLMProvider(this.llmFactory.getProvider(config), this.apiUsageService, {
      agentRole: role,
      projectId: projectId && projectId !== 'unknown' ? projectId : undefined,
    });
    return { provider, model: config.model };
  }
}

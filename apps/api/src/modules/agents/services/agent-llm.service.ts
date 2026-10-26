import { Injectable } from '@nestjs/common';
import { ILLMProvider, ModelRouteConfig } from '@ai-corp/shared-types';
import { MemoryService } from '../../memory/memory.service';
import { LLMProviderFactory } from '../../llm/llm-provider.factory';
import { ApiUsageService } from '../../llm/api-usage.service';
import { UsageTrackingLLMProvider } from '../../llm/usage-tracking.provider';
import { RoleProfile } from '../profiles/role-profile';

/**
 * AgentLLMService
 *
 * One place where agent strategies get their LLM: resolves the role's model config
 * (the one saved in Agent Settings, or the role profile's default) and returns a provider
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
    profile: RoleProfile,
    projectId?: string
  ): Promise<{ provider: ILLMProvider; model: string; systemPrompt: string }> {
    const config: ModelRouteConfig = await this.memoryService.getModelConfigForAgent(profile.role, profile.modelConfig());
    const provider = new UsageTrackingLLMProvider(this.llmFactory.getProvider(config), this.apiUsageService, {
      agentRole: profile.role,
      projectId: projectId && projectId !== 'unknown' ? projectId : undefined,
    });
    return { provider, model: config.model, systemPrompt: profile.systemPrompt };
  }
}

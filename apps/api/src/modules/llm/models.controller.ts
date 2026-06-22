import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('models')
export class ModelsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async listModels() {
    const agents = await this.prisma.agent.findMany({
      select: { role: true, name: true, modelRouteConfig: true, isActive: true },
      orderBy: { role: 'asc' },
    });
    return agents;
  }

  @Get('available')
  async listAvailableModels() {
    // Return the curated list of available OpenRouter models
    return [
      { id: 'openrouter/openrouter/free', name: 'OpenRouter Free', provider: 'openrouter', category: 'general' },
      { id: 'openrouter/openrouter/owl-alpha', name: 'OWL Alpha', provider: 'openrouter', category: 'general' },
      { id: 'openrouter/nvidia/nemotron-3-super-120b-a12b:free', name: 'Nemotron 3 Super 120B', provider: 'openrouter', category: 'general' },
      { id: 'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free', name: 'Nemotron 3 Ultra 550B', provider: 'openrouter', category: 'general' },
      { id: 'openrouter/poolside/laguna-xs.2:free', name: 'Laguna XS', provider: 'openrouter', category: 'code' },
      { id: 'openrouter/poolside/laguna-m.1:free', name: 'Laguna M', provider: 'openrouter', category: 'code' },
      { id: 'openrouter/cohere/north-mini-code:free', name: 'North Mini Code', provider: 'openrouter', category: 'code' },
      { id: 'openrouter/google/gemma-4-31b-it:free', name: 'Gemma 4 31B', provider: 'openrouter', category: 'general' },
      { id: 'openrouter/google/gemma-4-26b-a4b-it:free', name: 'Gemma 4 26B', provider: 'openrouter', category: 'general' },
      { id: 'openrouter/nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', name: 'Nemotron 3 Nano Omni', provider: 'openrouter', category: 'reasoning' },
      { id: 'openrouter/nvidia/nemotron-3-nano-30b-a3b:free', name: 'Nemotron 3 Nano', provider: 'openrouter', category: 'general' },
      { id: 'openrouter/nex-agi/nex-n2-pro:free', name: 'NEX N2 Pro', provider: 'openrouter', category: 'general' },
      { id: 'cx/gpt-5.5', name: 'GPT-5.5', provider: 'cx', category: 'premium' },
      { id: 'cx/gpt-5.4', name: 'GPT-5.4', provider: 'cx', category: 'premium' },
      { id: 'cx/gpt-5.4-mini', name: 'GPT-5.4 Mini', provider: 'cx', category: 'general' },
      { id: 'ds/deepseek-v4-pro', name: 'DeepSeek V4 Pro', provider: 'deepseek', category: 'general' },
      { id: 'ds/deepseek-v4-flash', name: 'DeepSeek V4 Flash', provider: 'deepseek', category: 'general' },
      { id: 'groq/llama-3.3-70b-versatile', name: 'Llama 3.3 70B', provider: 'groq', category: 'general' },
      { id: 'groq/qwen/qwen3-32b', name: 'Qwen 3 32B', provider: 'groq', category: 'general' },
    ];
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':role')
  async updateAgentModel(@Param('role') role: string, @Body() body: { model: string }) {
    const agent = await this.prisma.agent.findUnique({ where: { role: role.toUpperCase() } });
    if (!agent) {
      return { error: `Agent ${role} not found` };
    }

    const updated = await this.prisma.agent.update({
      where: { role: role.toUpperCase() },
      data: {
        modelRouteConfig: {
          ...(agent.modelRouteConfig as any),
          model: body.model,
        },
      },
    });

    return { success: true, agent: updated };
  }
}

import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CostService {
  private readonly logger = new Logger(CostService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getSummary(projectId?: string) {
    const where: any = {};
    if (projectId) where.projectId = projectId;

    const logs = await this.prisma.apiUsageLog.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    let totalCost = 0;
    let totalTokens = 0;
    let rtkTokensSaved = 0;
    const byAgentMap = new Map<string, { cost: number; tokens: number; calls: number }>();
    const byModelMap = new Map<string, { cost: number; tokens: number; calls: number }>();
    const costOverTimeMap = new Map<string, number>();

    for (const log of logs) {
      const cost = Number(log.actualCost);
      totalCost += cost;
      totalTokens += log.totalTokens;
      rtkTokensSaved += log.rtkTokenSaved ?? 0;

      // By agent
      const agentKey = log.agentRole;
      const agentEntry = byAgentMap.get(agentKey) ?? { cost: 0, tokens: 0, calls: 0 };
      agentEntry.cost += cost;
      agentEntry.tokens += log.totalTokens;
      agentEntry.calls += 1;
      byAgentMap.set(agentKey, agentEntry);

      // By model
      const modelKey = log.actualModelUsed;
      const modelEntry = byModelMap.get(modelKey) ?? { cost: 0, tokens: 0, calls: 0 };
      modelEntry.cost += cost;
      modelEntry.tokens += log.totalTokens;
      modelEntry.calls += 1;
      byModelMap.set(modelKey, modelEntry);

      // Over time (by date)
      const dateKey = log.createdAt.toISOString().slice(0, 10);
      costOverTimeMap.set(dateKey, (costOverTimeMap.get(dateKey) ?? 0) + cost);
    }

    return {
      totalCost,
      totalTokens,
      rtkTokensSaved,
      byAgent: Array.from(byAgentMap.entries()).map(([agent, data]) => ({
        agentRole: agent,
        totalCost: data.cost,
        totalTokens: data.tokens,
        requestCount: data.calls,
        promptTokens: 0,
        completionTokens: 0,
        rtkTokensSaved: 0,
      })),
      byModel: Array.from(byModelMap.entries()).map(([model, data]) => ({
        model,
        provider: '9Router',
        requestCount: data.calls,
        totalTokens: data.tokens,
        cost: data.cost,
        fallbackTriggered: 0,
      })),
      costOverTime: Array.from(costOverTimeMap.entries()).map(([date, cost]) => ({
        date,
        cost,
        tokens: 0,
      })),
    };
  }
}

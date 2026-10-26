import { Injectable, Logger } from '@nestjs/common';
import { MemoryService, LESSONS_NAMESPACE } from '../memory/memory.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentLLMService } from '../agents/services/agent-llm.service';
import { ROLE_PROFILES } from '../agents/profiles';
import {
  describeOutcome,
  EXECUTION_OUTCOMES_NAMESPACE,
  ExecutionOutcome,
} from '../../domain/agent/learning/ExecutionOutcome';

export interface LearningStats {
  role: string;
  outcomes: number;
  successes: number;
  successRate: number | null;
  /** Per day, oldest first */
  timeline: Array<{ date: string; total: number; successes: number; successRate: number }>;
  bySignal: Record<string, { total: number; successes: number }>;
  lessons: Array<{ id: string; content: string; importance: number; createdAt: string }>;
  recentOutcomes: Array<{ content: string; success: boolean; signal: string; createdAt: string }>;
}

/**
 * LearningService (Task 14)
 *
 * 1. Stores each graded execution as a memory of the graded role (namespace execution_outcomes,
 *    structured outcome in the metadata).
 * 2. Every N outcomes of a role (LEARNING_REFINE_EVERY, default 3) it refines the recent ones
 *    into a lessons_learned memory with an LLM call made through AgentLLMService (so it is
 *    costed like any agent call). Thinking strategies recall these lessons first.
 */
@Injectable()
export class LearningService {
  private readonly logger = new Logger(LearningService.name);

  constructor(
    private readonly memory: MemoryService,
    private readonly agentLLM: AgentLLMService,
    private readonly prisma: PrismaService
  ) {}

  static refineEvery(): number {
    const n = Number(process.env.LEARNING_REFINE_EVERY);
    return Number.isInteger(n) && n > 0 ? n : 3;
  }

  /**
   * Save the outcome; returns whether this outcome is the N-th of its role
   * (the caller then runs refine(), in the background).
   */
  async recordOutcome(outcome: ExecutionOutcome): Promise<{ memoryId: string | null; shouldRefine: boolean }> {
    const agentId = await this.memory.getAgentIdByRole(outcome.role);
    if (!agentId) {
      this.logger.warn(`No agent row for ${outcome.role}; outcome not stored`);
      return { memoryId: null, shouldRefine: false };
    }
    const memoryId = await this.memory.saveMemory(agentId, outcome.role, EXECUTION_OUTCOMES_NAMESPACE, describeOutcome(outcome), {
      projectId: outcome.projectId,
      // Failures teach more than successes
      importance: outcome.success ? 4 : 7,
      tags: [outcome.signal, outcome.success ? 'success' : 'failure'],
      outcome: { ...outcome },
    });
    const count = await this.memory.countMemories(outcome.role, EXECUTION_OUTCOMES_NAMESPACE);
    return { memoryId, shouldRefine: count > 0 && count % LearningService.refineEvery() === 0 };
  }

  /** Summarise the role's recent outcomes into one lesson (LLM call, costed) */
  async refine(role: string): Promise<string | null> {
    const profile = ROLE_PROFILES.find(p => p.role === role);
    if (!profile) return null;
    return this.memory.refineMemory(role, EXECUTION_OUTCOMES_NAMESPACE, async memories => {
      const { provider, model, systemPrompt } = await this.agentLLM.providerFor(profile);
      const lines = memories.map((m, i) => `${i + 1}. ${m.content}`).join('\n');
      const result = await provider.chat({
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `These are the graded outcomes of your recent work as the ${profile.displayName} (oldest first):

${lines}

Compare the successes with the failures and write the lesson you should apply next time.
Rules:
- 2 to 4 short, concrete, imperative bullet points (start each with "- ")
- Name the check, use case or practice involved; no generic advice
- If everything succeeded, state what to keep doing
Reply with the bullet points only.`,
          },
        ],
        model,
        maxTokens: 400,
        temperature: 0.2,
      });
      return LearningService.cleanLesson(result.content || '');
    });
  }

  /** Keep the bullet lines of the LLM reply (or the whole reply when it has none) */
  static cleanLesson(reply: string): string {
    const bullets = reply
      .split('\n')
      .map(l => l.trim())
      .filter(l => /^[-*•]\s+/.test(l))
      .map(l => `- ${l.replace(/^[-*•]\s+/, '')}`);
    return (bullets.length ? bullets.slice(0, 4).join('\n') : reply.trim()).slice(0, 1200);
  }

  async stats(role: string, days = 30): Promise<LearningStats> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const [outcomes, lessons] = await Promise.all([
      this.prisma.agentMemory.findMany({
        where: { agentRole: role, namespace: EXECUTION_OUTCOMES_NAMESPACE, createdAt: { gte: since } },
        orderBy: { createdAt: 'asc' },
        select: { content: true, metadata: true, createdAt: true },
      }),
      this.prisma.agentMemory.findMany({
        where: { agentRole: role, namespace: LESSONS_NAMESPACE },
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
        take: 5,
        select: { id: true, content: true, importance: true, createdAt: true },
      }),
    ]);

    const parsed = outcomes.map(o => {
      const outcome = ((o.metadata as any)?.outcome || {}) as Partial<ExecutionOutcome>;
      return { content: o.content, success: outcome.success === true, signal: outcome.signal || 'unknown', createdAt: o.createdAt };
    });

    const byDay = new Map<string, { total: number; successes: number }>();
    const bySignal: LearningStats['bySignal'] = {};
    for (const o of parsed) {
      const day = o.createdAt.toISOString().slice(0, 10);
      const d = byDay.get(day) || { total: 0, successes: 0 };
      d.total++;
      if (o.success) d.successes++;
      byDay.set(day, d);
      const s = (bySignal[o.signal] ||= { total: 0, successes: 0 });
      s.total++;
      if (o.success) s.successes++;
    }
    const successes = parsed.filter(o => o.success).length;
    const pct = (a: number, b: number) => Math.round((a / b) * 1000) / 10;

    return {
      role,
      outcomes: parsed.length,
      successes,
      successRate: parsed.length ? pct(successes, parsed.length) : null,
      timeline: Array.from(byDay.entries()).map(([date, d]) => ({ date, ...d, successRate: pct(d.successes, d.total) })),
      bySignal,
      lessons: lessons.map(l => ({ id: l.id, content: l.content, importance: l.importance, createdAt: l.createdAt.toISOString() })),
      recentOutcomes: parsed.slice(-10).reverse().map(o => ({ ...o, createdAt: o.createdAt.toISOString() })),
    };
  }
}

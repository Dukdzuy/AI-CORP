import { AgentRole } from '@ai-corp/shared-types';
import { MemoryService, LESSON_PREFIX, keywordTokens } from '../../../src/modules/memory/memory.service';
import { OutcomeSignalPolicy } from '../../../src/modules/learning/outcome-signal.policy';
import { LearningService } from '../../../src/modules/learning/learning.service';
import { AgentLearningHandler } from '../../../src/modules/learning/agent-learning.handler';
import { AgentCompletedTaskEvent } from '../../../src/domain/events/AgentCompletedTaskEvent';
import { QualityGateEvaluatedEvent } from '../../../src/domain/events/QualityGateEvaluatedEvent';
import { ExecutionOutcome } from '../../../src/domain/agent/learning/ExecutionOutcome';
import { MarketingThinkingStrategy, MarketingActionStrategy } from '../../../src/modules/agents/strategies';

/** In-memory stand-in for the parts of Prisma that MemoryService and LearningService use */
function fakePrisma() {
  const rows: any[] = [];
  let seq = 0;
  let clock = Date.parse('2026-10-20T08:00:00Z');
  const matches = (row: any, where: any = {}) =>
    Object.entries(where).every(([key, cond]: [string, any]) => {
      if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
        if ('gte' in cond) return row[key] >= cond.gte;
        if ('not' in cond) return row[key] !== cond.not;
      }
      return row[key] === cond;
    });
  const sort = (list: any[], orderBy: any) => {
    const keys = (Array.isArray(orderBy) ? orderBy : orderBy ? [orderBy] : []).flatMap((o: any) => Object.entries(o));
    return [...list].sort((a, b) => {
      for (const [k, dir] of keys as Array<[string, string]>) {
        if (a[k] < b[k]) return dir === 'asc' ? -1 : 1;
        if (a[k] > b[k]) return dir === 'asc' ? 1 : -1;
      }
      return 0;
    });
  };
  return {
    rows,
    /** Each saved memory is one hour after the previous one */
    agent: { findFirst: jest.fn(async ({ where }: any) => ({ id: `agent-${where.role}` })) },
    agentMemory: {
      create: jest.fn(async ({ data }: any) => {
        const row = { id: `m${++seq}`, createdAt: new Date((clock += 3600_000)), ...data };
        rows.push(row);
        return row;
      }),
      findMany: jest.fn(async ({ where, orderBy, take }: any) => {
        const list = sort(rows.filter(r => matches(r, where)), orderBy);
        return take ? list.slice(0, take) : list;
      }),
      count: jest.fn(async ({ where }: any) => rows.filter(r => matches(r, where)).length),
    },
  };
}

const noEmbeddings = { isEnabled: () => false, generateEmbedding: jest.fn() };

function llm(reply: string) {
  const prompts: string[] = [];
  const chat = jest.fn(async (params: any) => {
    prompts.push(params.messages.map((m: any) => m.content).join('\n---\n'));
    return { content: reply };
  });
  return { prompts, chat, agentLLM: { providerFor: jest.fn(async (p: any) => ({ provider: { chat }, model: 'm', systemPrompt: p.systemPrompt })) } };
}

const outcome = (role: string, success: boolean, details: string[] = []): ExecutionOutcome => ({
  role, projectId: 'p1', signal: 'ooad_gate', success, score: success ? 100 : 60, details, source: 'ooad_gate',
});

describe('OutcomeSignalPolicy', () => {
  const policy = new OutcomeSignalPolicy();

  it('grades BA and Architect with the OOAD gate', () => {
    const outcomes = policy.fromGate(new QualityGateEvaluatedEvent('p1', 'ooad_gate', false, 60, ['Entities: 2 (expected >= 3)']));
    expect(outcomes.map(o => [o.role, o.signal, o.success, o.score])).toEqual([
      ['BA', 'ooad_gate', false, 60],
      ['ARCHITECT', 'ooad_gate', false, 60],
    ]);
    expect(outcomes[1].details).toEqual(['Entities: 2 (expected >= 3)']);
  });

  it('grades DEV with QC verification', () => {
    const [o] = policy.fromAgentCompleted(new AgentCompletedTaskEvent('QC', 't', 'p1', {
      action: { success: true, output: { action: 'verify', qc_passed: false, testCoverage: 80, failingUseCases: ['UC-001'], missingUseCases: [], failingTests: ['UC-001: x: boom'], testsExecuted: true } },
    }));
    expect(o).toEqual(expect.objectContaining({ role: 'DEV', signal: 'qc_verification', success: false, score: 80, source: 'QC' }));
    expect(o.details).toEqual(['failing use cases UC-001', 'UC-001: x: boom']);
  });

  it('grades DEV and QC with the QA verdict, quoting the findings', () => {
    const outcomes = policy.fromAgentCompleted(new AgentCompletedTaskEvent('QA', 't', 'p1', {
      action: { success: true, output: { action: 'review', qa_approved: false, output: '1. Domain imports infrastructure in Order.ts\nVERDICT: FAIL' } },
    }));
    expect(outcomes.map(o => o.role)).toEqual(['DEV', 'QC']);
    expect(outcomes[0].details).toEqual(['Domain imports infrastructure in Order.ts']);
  });

  it('ignores executions without a signal, failed actions and unknown projects', () => {
    const ev = (role: string, projectId: string, action: any) => new AgentCompletedTaskEvent(role, 't', projectId, { action });
    expect(policy.fromAgentCompleted(ev('DEV', 'p1', { success: true, output: { action: 'implement' } }))).toEqual([]);
    expect(policy.fromAgentCompleted(ev('QA', 'p1', { success: false, output: null }))).toEqual([]);
    expect(policy.fromAgentCompleted(ev('QA', 'unknown', { success: true, output: { qa_approved: true } }))).toEqual([]);
    expect(policy.fromGate(new QualityGateEvaluatedEvent('unknown', 'g', true, 100, []))).toEqual([]);
  });
});

describe('Learning loop', () => {
  const OLD_N = process.env.LEARNING_REFINE_EVERY;
  afterAll(() => { process.env.LEARNING_REFINE_EVERY = OLD_N; });
  beforeEach(() => { delete process.env.LEARNING_REFINE_EVERY; });

  it('stores outcomes and triggers refinement on the N-th outcome only', async () => {
    const prisma = fakePrisma();
    const memory = new MemoryService(prisma as any, noEmbeddings as any);
    const { agentLLM } = llm('- keep going');
    const service = new LearningService(memory, agentLLM as any, prisma as any);
    const handler = new AgentLearningHandler(service);
    const refine = jest.spyOn(service, 'refine').mockResolvedValue('lesson-id');

    const gate = (passed: boolean) => new QualityGateEvaluatedEvent('p1', 'ooad_gate', passed, passed ? 100 : 60, passed ? [] : ['Patterns: 1 (expected >= 3)']);
    await handler.handle(gate(false)); // BA 1, ARCHITECT 1
    await handler.handle(gate(false)); // 2
    expect(refine).not.toHaveBeenCalled();
    await handler.handle(gate(true)); // 3rd outcome of each role
    await Promise.all(handler.pending);
    expect(refine.mock.calls.map(c => c[0])).toEqual(['BA', 'ARCHITECT']);
    await handler.handle(gate(true)); // 4th
    expect(refine).toHaveBeenCalledTimes(2);

    const saved = prisma.rows.filter(r => r.agentRole === 'ARCHITECT');
    expect(saved).toHaveLength(4);
    expect(saved[0]).toEqual(expect.objectContaining({ namespace: 'execution_outcomes', importance: 7, embedding: null }));
    expect(saved[0].content).toBe('FAILURE ooad_gate from ooad_gate (score 60%) on project p1: Patterns: 1 (expected >= 3)');
    expect(saved[0].metadata.outcome).toEqual(expect.objectContaining({ signal: 'ooad_gate', success: false }));
    expect(saved[2].importance).toBe(4);
  });

  it('honours LEARNING_REFINE_EVERY', async () => {
    process.env.LEARNING_REFINE_EVERY = '2';
    const prisma = fakePrisma();
    const service = new LearningService(new MemoryService(prisma as any, noEmbeddings as any), llm('').agentLLM as any, prisma as any);
    expect((await service.recordOutcome(outcome('DEV', true))).shouldRefine).toBe(false);
    expect((await service.recordOutcome(outcome('DEV', false))).shouldRefine).toBe(true);
  });

  it('refines outcomes into a lesson that appears in the next prompt', async () => {
    const prisma = fakePrisma();
    const memory = new MemoryService(prisma as any, noEmbeddings as any);
    const refiner = llm('Here is what I learned:\n- Name every campaign after a use case\n- Keep announcements under 120 words\nThanks');
    const service = new LearningService(memory, refiner.agentLLM as any, prisma as any);
    await service.recordOutcome(outcome('MARKETING', false, ['announcement ignored UC-002']));
    await service.recordOutcome(outcome('MARKETING', true));

    const lessonId = await service.refine('MARKETING');

    expect(refiner.prompts[0]).toContain('1. FAILURE ooad_gate');
    expect(refiner.prompts[0]).toContain('announcement ignored UC-002');
    expect(refiner.prompts[0]).toContain('2. SUCCESS ooad_gate');
    const lesson = prisma.rows.find(r => r.id === lessonId);
    expect(lesson).toEqual(expect.objectContaining({
      namespace: 'lessons_learned', importance: 9,
      content: '- Name every campaign after a use case\n- Keep announcements under 120 words',
    }));

    // Next execution: the thinking strategy recalls the lesson and the action prompt carries it
    const thought = await new MarketingThinkingStrategy(memory).think({ projectId: 'p2', goal: 'Sell books', task: 'announce' } as any);
    expect(thought.memories![0]).toBe(`${LESSON_PREFIX}- Name every campaign after a use case\n- Keep announcements under 120 words`);
    const next = llm('We are live!');
    const ws = { sendToProject: jest.fn() };
    await new MarketingActionStrategy(memory, next.agentLLM as any, ws as any).act({ projectId: 'p2', projectSummary: 'Book shop' } as any, thought);
    expect(next.prompts[0]).toContain('Keep announcements under 120 words');
  });

  it('returns nothing to refine for a role without outcomes', async () => {
    const prisma = fakePrisma();
    const refiner = llm('- x');
    const service = new LearningService(new MemoryService(prisma as any, noEmbeddings as any), refiner.agentLLM as any, prisma as any);
    expect(await service.refine('QA')).toBeNull();
    expect(refiner.chat).not.toHaveBeenCalled();
    expect(await service.refine('NOT_A_ROLE')).toBeNull();
  });

  it('reports success rate per day, per signal and the top lessons', async () => {
    const prisma = fakePrisma();
    const memory = new MemoryService(prisma as any, noEmbeddings as any);
    const service = new LearningService(memory, llm('').agentLLM as any, prisma as any);
    jest.useFakeTimers().setSystemTime(new Date('2026-10-21T12:00:00Z'));
    try {
      for (const ok of [false, false, true, true]) await service.recordOutcome(outcome('ARCHITECT', ok)); // hours 1-4 of 10-20
      for (let i = 0; i < 20; i++) await memory.saveMemory('agent-ARCHITECT', 'ARCHITECT', 'architecture_patterns', `note ${i}`); // pushes the clock
      await service.recordOutcome(outcome('ARCHITECT', true)); // 10-21
      await memory.saveMemory('agent-ARCHITECT', 'ARCHITECT', 'lessons_learned', 'Add a Repository per aggregate', { importance: 9 });

      const stats = await service.stats('ARCHITECT');

      expect(stats).toEqual(expect.objectContaining({ outcomes: 5, successes: 3, successRate: 60 }));
      expect(stats.timeline).toEqual([
        { date: '2026-10-20', total: 4, successes: 2, successRate: 50 },
        { date: '2026-10-21', total: 1, successes: 1, successRate: 100 },
      ]);
      expect(stats.bySignal).toEqual({ ooad_gate: { total: 5, successes: 3 } });
      expect(stats.lessons.map(l => l.content)).toEqual(['Add a Repository per aggregate']);
      expect(stats.recentOutcomes[0].success).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });

  it('cleans the LLM reply down to bullet points', () => {
    expect(LearningService.cleanLesson('Sure!\n* one\n• two\n- three\n- four\n- five')).toBe('- one\n- two\n- three\n- four');
    expect(LearningService.cleanLesson('  just text  ')).toBe('just text');
  });
});

describe('MemoryService keyword fallback (no embedding provider)', () => {
  it('saves without an embedding and finds memories by keywords', async () => {
    const prisma = fakePrisma();
    const memory = new MemoryService(prisma as any, noEmbeddings as any);
    await memory.saveMemory('a', 'DEV', 'coding_conventions', 'Use in-memory repositories in acceptance tests', { importance: 5 });
    await memory.saveMemory('a', 'DEV', 'coding_conventions', 'Prefer value objects for Money and Email', { importance: 8 });
    await memory.saveMemory('a', 'DEV', 'coding_conventions', 'Unrelated note about logging', { importance: 2 });

    const results = await memory.searchMemories('DEV', 'coding_conventions', 'Implement OrderService with repositories and Money value objects', 5);

    expect(noEmbeddings.generateEmbedding).not.toHaveBeenCalled();
    expect(prisma.rows.every(r => r.embedding === null)).toBe(true);
    expect(results.map(r => r.content)).toEqual([
      'Prefer value objects for Money and Email',
      'Use in-memory repositories in acceptance tests',
    ]);
    expect(results[0].similarity).toBeGreaterThan(0);
  });

  it('falls back to importance and recency when no keyword matches', async () => {
    const prisma = fakePrisma();
    const memory = new MemoryService(prisma as any, noEmbeddings as any);
    await memory.saveMemory('a', 'QA', 'review_checklist', 'Check layering', { importance: 3 });
    await memory.saveMemory('a', 'QA', 'review_checklist', 'Check UC comments', { importance: 9 });
    const results = await memory.searchMemories('QA', 'review_checklist', 'zzz', 1);
    expect(results.map(r => r.content)).toEqual(['Check UC comments']);
  });

  it('recall puts lessons first and isolates roles', async () => {
    const prisma = fakePrisma();
    const memory = new MemoryService(prisma as any, noEmbeddings as any);
    await memory.saveMemory('a', 'BA', 'requirements_analysis', 'List actors first');
    await memory.saveMemory('a', 'BA', 'lessons_learned', 'Write at least 5 use cases', { importance: 9 });
    await memory.saveMemory('a', 'DEV', 'lessons_learned', 'DEV lesson', { importance: 9 });
    expect(await memory.recall('BA', 'requirements_analysis', '', 5)).toEqual([
      `${LESSON_PREFIX}Write at least 5 use cases`,
      'List actors first',
    ]);
  });

  it('tokenises without stopwords or short words', () => {
    expect(Array.from(keywordTokens('The Order has 2 lines, and Đặt hàng'))).toEqual(['order', 'lines', 'đặt', 'hàng']);
  });
});

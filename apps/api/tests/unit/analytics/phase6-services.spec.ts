import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { Logger } from '@nestjs/common';
import { EventBus } from '../../../src/domain/events/EventBus';
import { AgentAnomalyDetectedEvent } from '../../../src/domain/events';
import { WorkflowStartedEvent } from '../../../src/domain/events/WorkflowStartedEvent';
import { AgentAnalyticsService } from '../../../src/modules/analytics/agent-analytics.service';
import { AgentAnomalyMonitor } from '../../../src/modules/analytics/agent-anomaly.monitor';
import { parseStepOutput, stepOutputFields } from '../../../src/modules/analytics/step-output';
import { toEnvelope } from '../../../src/modules/integrations/webhook-payloads';
import { AUDITED_EVENTS } from '../../../src/modules/events/handlers/AuditLogHandler';
import { TrainingDataCollector } from '../../../src/modules/estimation/training-data.collector';
import { ProjectEstimationService } from '../../../src/modules/estimation/project-estimation.service';
import { EstimationHandler } from '../../../src/modules/estimation/estimation.handler';
import { EstimationSample } from '../../../src/domain/estimation';
import { AgentTaskStrategy } from '../../../src/modules/workflow/strategies/agent-task.strategy';
import { DevActionStrategy, QaActionStrategy } from '../../../src/modules/agents/strategies';
import { CodeQualityService } from '../../../src/modules/code-quality/code-quality.service';
import { TypeScriptCodeAnalyzer } from '../../../src/infrastructure/code-analysis/TypeScriptCodeAnalyzer';
import { ProjectWorkspace } from '../../../src/modules/workspace/project-workspace.service';
import { DevOutput } from '../../../src/domain/agent/AgentOutputs';
import { createMockAgentContext } from '../../utils';

const NOW = new Date('2026-10-26T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);
const agentOutput = (fields: Record<string, unknown>) => JSON.stringify({ thought: {}, action: { success: true, output: fields } });

describe('Phase 6 / Task 24: step outputs', () => {
  it('reads verdicts and the code-quality prediction from stored agent outputs of any shape', () => {
    expect(stepOutputFields(agentOutput({ qa_approved: false }))).toEqual({ qaApproved: false });
    expect(stepOutputFields({ action: { output: { qc_passed: true } } })).toEqual({ qcPassed: true });
    expect(stepOutputFields(agentOutput({ codeQuality: { predictedQaVerdict: 'fail' } }))).toEqual({ predictedQaVerdict: 'fail' });
    expect(stepOutputFields({ qa_approved: true })).toEqual({ qaApproved: true });
    expect(stepOutputFields('not json')).toEqual({});
    expect(stepOutputFields(null)).toEqual({});
    expect(parseStepOutput(42)).toBeNull();
  });
});

/** Prisma stub over in-memory rows for the analytics queries */
function analyticsPrisma(rows: { steps: any[]; usage: any[]; gates: any[] }) {
  return {
    workflowStep: {
      findMany: jest.fn(async ({ where, select }: any) =>
        rows.steps
          .filter(s => s.startedAt >= where.startedAt.gte)
          .filter(s => (where.agentRole?.in ? where.agentRole.in.includes(s.agentRole) : s.agentRole !== null))
          .filter(s => !where.workflowRun || s.projectId === where.workflowRun.projectId)
          .map(s => (select.output ? { id: s.id, output: s.output } : s))
      ),
    },
    apiUsageLog: { findMany: jest.fn(async () => rows.usage) },
    qualityGateLog: { findMany: jest.fn(async () => rows.gates) },
  };
}

const stepRow = (id: string, agentRole: string, status: string, at: Date, output: unknown = null, projectId = 'p1') => ({
  id, agentRole, nodeId: agentRole.toLowerCase(), status, durationMs: 100, retryCount: 0, startedAt: at, workflowRunId: 'r1', output, projectId,
});

describe('Phase 6 / Task 24: AgentAnalyticsService and the anomaly monitor', () => {
  const failingDev = [
    ...[12, 11, 10, 9].map((d, i) => stepRow(`old${i}`, 'DEV', 'completed', daysAgo(d))),
    ...[3, 2, 1].map((d, i) => stepRow(`new${i}`, 'DEV', 'failed', daysAgo(d))),
    stepRow('qa1', 'QA', 'completed', daysAgo(1), agentOutput({ qa_approved: true })),
    stepRow('dev-pred', 'DEV', 'completed', daysAgo(3.5), agentOutput({ codeQuality: { predictedQaVerdict: 'pass' } })),
  ];

  it('combines steps, verdicts from outputs, usage and gates, and lists anomalies', async () => {
    const prisma = analyticsPrisma({ steps: failingDev, usage: [{ agentRole: 'DEV', actualCost: '0.2', createdAt: daysAgo(1) }], gates: [] });
    const view = await new AgentAnalyticsService(prisma as any).analytics({ days: 7 }, NOW);

    const dev = view.roles.find(r => r.agentRole === 'DEV')!;
    expect(dev).toMatchObject({ executionCount: 4, completed: 1, failed: 3, totalCost: 0.2 });
    expect(dev.quality).toMatchObject({ value: 1, samples: 1 });
    expect(view.qaPrediction).toMatchObject({ samples: 1, truePass: 1 });
    expect(view.anomalies.map(a => [a.agentRole, a.type])).toEqual(expect.arrayContaining([['DEV', 'performance_degradation'], ['DEV', 'repeated_failures']]));
    // Outputs are only read for the roles that carry a verdict
    expect(prisma.workflowStep.findMany.mock.calls[1][0].where.agentRole).toEqual({ in: ['DEV', 'QA', 'QC'] });
  });

  it('filters by project', async () => {
    const prisma = analyticsPrisma({ steps: [...failingDev, stepRow('x', 'PM', 'completed', daysAgo(1), null, 'p2')], usage: [], gates: [] });
    const view = await new AgentAnalyticsService(prisma as any).analytics({ days: 7, projectId: 'p2' }, NOW);
    expect(view.roles.map(r => r.agentRole)).toEqual(['PM']);
    expect((prisma.apiUsageLog.findMany.mock.calls[0] as any[])[0].where.projectId).toBe('p2');
  });

  it('raises each anomaly once per day as a domain event that reaches webhooks and the audit log', async () => {
    const prisma = analyticsPrisma({ steps: failingDev, usage: [], gates: [] });
    const bus = new EventBus();
    const received: AgentAnomalyDetectedEvent[] = [];
    bus.subscribe('agent.anomaly', { handle: async (e: any) => { received.push(e); } });
    const monitor = new AgentAnomalyMonitor(new AgentAnalyticsService(prisma as any), bus);

    const first = await monitor.check('p1', NOW);
    expect(first.length).toBeGreaterThanOrEqual(2);
    expect(received.map(e => e.anomalyType)).toEqual(expect.arrayContaining(['repeated_failures', 'performance_degradation']));
    expect(await monitor.check('p1', NOW)).toEqual([]);
    expect((await monitor.check('p1', new Date(NOW.getTime() + 86_400_000))).length).toBeGreaterThan(0);

    const event = received[0];
    expect(toEnvelope(event)).toMatchObject({ event: 'agent.anomaly', projectId: 'p1', data: { agentRole: 'DEV', severity: 'high' } });
    expect(AUDITED_EVENTS['agent.anomaly'](event)).toMatchObject({ resourceType: 'Agent', resourceId: 'DEV', success: false, errorMessage: event.message });

    // A workflow ending triggers the check; a failing query is logged, not thrown
    const spy = jest.spyOn(monitor, 'check');
    await monitor.handle({ eventType: 'workflow.completed', projectId: 'p9', occurredOn: NOW } as any);
    expect(spy).toHaveBeenCalledWith('p9', NOW);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const broken = new AgentAnomalyMonitor({ analytics: jest.fn().mockRejectedValue(new Error('db down')) } as any, bus);
    await expect(broken.check()).resolves.toEqual([]);
  });
});

describe('Phase 6 / Task 25: training data and the estimation service', () => {
  const project = (id: string, useCases: number, desc = 'x'.repeat(500)) => ({
    id, name: `Project ${id}`, description: desc, goal: 'goal', ooadMetadata: { useCases: Array.from({ length: useCases }, (_, i) => ({ id: `UC-00${i}` })) },
  });

  function estimationPrisma() {
    const runs = [
      { projectId: 'a', status: 'completed', workflowDefId: 'ooad', completedAt: daysAgo(3), startedAt: daysAgo(4) },
      { projectId: 'b', status: 'completed', workflowDefId: 'ooad', completedAt: daysAgo(2), startedAt: daysAgo(3) },
      { projectId: 'c', status: 'failed', workflowDefId: 'ooad', startedAt: daysAgo(2) },
      { projectId: 'c', status: 'completed', workflowDefId: 'ooad', startedAt: daysAgo(5) }, // older run of c
      { projectId: 'new', status: 'running', workflowDefId: 'ooad', startedAt: daysAgo(0) },
    ];
    const projects = [project('a', 2), project('b', 4), project('c', 3), project('new', 0)];
    const steps = [
      { agentRole: 'DEV', durationMs: 4000, workflowRun: { projectId: 'a' } },
      { agentRole: 'DEV', durationMs: 2000, workflowRun: { projectId: 'a' } },
      { agentRole: 'BA', durationMs: 1000, workflowRun: { projectId: 'a' } },
      { agentRole: 'DEV', durationMs: 8000, workflowRun: { projectId: 'b' } },
      { agentRole: 'BA', durationMs: 1200, workflowRun: { projectId: 'b' } },
    ];
    const usage = [
      { projectId: 'a', agentRole: 'DEV', _sum: { actualCost: '0.06' } },
      { projectId: 'b', agentRole: 'DEV', _sum: { actualCost: '0.10' } },
      { projectId: 'b', agentRole: 'MARKETING', _sum: { actualCost: '0.01' } }, // no step → not a sample
    ];
    const estimates: any[] = [];
    const prisma = {
      workflowRun: {
        findMany: jest.fn(async () => [...runs].sort((x, y) => y.startedAt.getTime() - x.startedAt.getTime())),
        count: jest.fn(async () => runs.filter(r => r.status === 'completed').length),
        findFirst: jest.fn(async ({ where }: any) => {
          const list = runs.filter(r => (!where.projectId || r.projectId === where.projectId) && (!where.status || r.status === where.status));
          return list.sort((x, y) => y.startedAt.getTime() - x.startedAt.getTime())[0] ?? null;
        }),
      },
      project: {
        findMany: jest.fn(async ({ where }: any) => projects.filter(p => where.id.in.includes(p.id))),
        findUnique: jest.fn(async ({ where }: any) => {
          const p = projects.find(x => x.id === where.id);
          return p ? { ...p, workflowRuns: [{ workflowDefId: 'ooad' }] } : null;
        }),
      },
      workflowStep: {
        findMany: jest.fn(async () => steps),
        aggregate: jest.fn(async ({ where }: any) => ({
          _sum: { durationMs: steps.filter(s => s.workflowRun.projectId === where.workflowRun.projectId).reduce((t, s) => t + s.durationMs, 0) },
        })),
      },
      apiUsageLog: {
        groupBy: jest.fn(async () => usage),
        aggregate: jest.fn(async ({ where }: any) => ({
          _sum: { actualCost: usage.filter(u => u.projectId === where.projectId).reduce((t, u) => t + Number(u._sum.actualCost), 0) },
        })),
      },
      projectEstimate: {
        create: jest.fn(async ({ data }: any) => {
          const row = { id: `e${estimates.length}`, createdAt: new Date(NOW.getTime() + estimates.length), ...data, project: { name: `Project ${data.projectId}` } };
          estimates.push(row);
          return row;
        }),
        findMany: jest.fn(async ({ where }: any = {}) => estimates.filter(e => !where?.projectId || e.projectId === where.projectId)),
      },
    };
    return { prisma, estimates };
  }

  it('collects one sample per finished project and role (latest run completed, usage needs a step)', async () => {
    const { prisma } = estimationPrisma();
    const samples = await new TrainingDataCollector(prisma as any).collect();
    const byKey = (p: string, r: string) => samples.find(s => s.projectId === p && s.role === r) as EstimationSample;
    expect(samples.map(s => `${s.projectId}:${s.role}`).sort()).toEqual(['a:BA', 'a:DEV', 'b:BA', 'b:DEV']);
    expect(byKey('a', 'DEV')).toMatchObject({ durationMs: 6000, cost: 0.06, workflowDefId: 'ooad', features: { useCaseCount: 2, descriptionLength: 504 } });
    expect(byKey('a', 'BA').cost).toBe(0);

    const none = { workflowRun: { findMany: jest.fn(async () => []) } };
    expect(await new TrainingDataCollector(none as any).collect()).toEqual([]);
  });

  it('forecasts a new project, stores forecasts, prices planned tasks and compares with the outcome', async () => {
    const { prisma, estimates } = estimationPrisma();
    const service = new ProjectEstimationService(prisma as any, new TrainingDataCollector(prisma as any));

    const forecast = await service.forecast('new');
    expect(forecast.imputed).toEqual(['useCaseCount']); // 'new' has no use cases yet
    expect(forecast.byRole.map(r => [r.role, r.method])).toEqual([['BA', 'median'], ['DEV', 'median']]);
    expect(forecast.durationMs).toBe(1100 + 7000);
    expect(forecast.confidence).toBe('low'); // 2 samples per role

    // Model is cached until another run completes
    await service.forecast('new');
    expect(prisma.workflowRun.findMany).toHaveBeenCalledTimes(1);

    await new EstimationHandler(service).handle(new WorkflowStartedEvent('r9', 'new', 'ooad'));
    expect(estimates[0]).toMatchObject({ projectId: 'new', stage: 'start', predictedDurationMs: 8100, confidence: 'low' });

    // DEV median cost 0.08 shared by 4 tasks
    expect(await service.estimateTaskCost('new', 4)).toBe(0.02);
    expect(estimates[1].stage).toBe('planned');
    expect(await service.estimateTaskCost('new', 0)).toBeNull();

    const view = await service.projectEstimate('new');
    expect(view.history.map(h => h.stage)).toEqual(['start', 'planned']);
    expect(view.actual).toEqual({ durationMs: 0, cost: 0, finished: false });
    expect(view.comparison).toBeNull();

    // A finished project with a forecast is part of the accuracy table
    await service.record('a', 'start');
    const model = await service.modelView();
    expect(model.trainingProjects).toBe(2);
    expect(model.roles.map(r => r.role)).toEqual(['BA', 'DEV']);
    expect(model.accuracy).toEqual([expect.objectContaining({ projectId: 'a', projectName: 'Project a', stage: 'start', actualDurationMs: 7000 })]);
    expect(model.meanAbsoluteDurationError).not.toBeNull();
    const done = await service.projectEstimate('a');
    expect(done.comparison).toMatchObject({ stage: 'start', actualDurationMs: 7000 });

    await expect(service.forecast('missing')).rejects.toThrow(/not found/);
  });

  it('does not store a forecast without history, and task estimation never breaks task creation', async () => {
    const prisma = {
      workflowRun: { count: jest.fn(async () => 0), findFirst: jest.fn(async () => null), findMany: jest.fn(async () => []) },
      project: { findUnique: jest.fn(async () => ({ ...project('x', 1), workflowRuns: [] })) },
      projectEstimate: { create: jest.fn() },
    };
    const service = new ProjectEstimationService(prisma as any, new TrainingDataCollector(prisma as any));
    expect(await service.record('x', 'start')).toBeNull();
    expect(prisma.projectEstimate.create).not.toHaveBeenCalled();
    expect(await service.estimateTaskCost('x', 3)).toBeNull();

    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    prisma.project.findUnique.mockRejectedValueOnce(new Error('db down'));
    expect(await service.estimateTaskCost('x', 3)).toBeNull();
    await expect(new EstimationHandler({ record: jest.fn().mockRejectedValue(new Error('x')) } as any).handle(new WorkflowStartedEvent('r', 'x', 'd'))).resolves.toBeUndefined();
  });

  it('the PM step creates its tasks with the estimated cost (ITaskCostEstimator port)', async () => {
    expect(AgentTaskStrategy.parseTaskTitles('Plan:\n1. UC-001 Place order - do it\n2) UC-002 Pay\n- ok')).toEqual(['UC-001 Place order - do it', 'UC-002 Pay']);
    expect(AgentTaskStrategy.parseTaskTitles('Just build it all')).toEqual(['Just build it all']);

    const created: any[] = [];
    const tasks = { create: jest.fn(async (t: any) => created.push(t)) };
    const estimator = { estimateTaskCost: jest.fn(async () => 0.25) };
    const ctx = { logger: { log: jest.fn(), warn: jest.fn() } };
    const strategy = new AgentTaskStrategy({} as any, {} as any, {} as any, {} as any, tasks as any, estimator);
    await (strategy as any).createTasksFromOutput('p1', '1. UC-001 Place order\n2. UC-002 Pay', ctx);
    expect(estimator.estimateTaskCost).toHaveBeenCalledWith('p1', 2);
    expect(created.map(t => [t.title, t.estimatedCost])).toEqual([['UC-001 Place order', 0.25], ['UC-002 Pay', 0.25]]);

    const plain = new AgentTaskStrategy({} as any, {} as any, {} as any, {} as any, tasks as any);
    await (plain as any).createTasksFromOutput('p1', '1. UC-003 Ship', ctx);
    expect(created[2]).toMatchObject({ title: 'UC-003 Ship', estimatedCost: null });
  });
});

describe('Phase 6 / Task 26: DEV refinement and QA evidence', () => {
  let root: string;
  let workspace: ProjectWorkspace;
  const projectId = 'proj-cq';
  const MESSY = [
    "import { Db } from '../../infrastructure/Db';",
    "const apiKey = 'sk-live-1234567890';",
    'export function run(x: number) { eval("x"); document.write("x"); return new Function("return x")(); }',
  ].join('\n');
  const FIXED = "// UC-001\nexport function run(x: number): number {\n  return x;\n}";

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'dev-cq-'));
    process.env.PROJECTS_WORKSPACE_DIR = root;
    workspace = new ProjectWorkspace();
  });
  afterEach(() => {
    delete process.env.PROJECTS_WORKSPACE_DIR;
    delete process.env.CODE_QUALITY_REFINE;
    fs.rmSync(root, { recursive: true, force: true });
  });

  function dev(replies: string[]) {
    const prompts: string[] = [];
    const chat = jest.fn(async (p: any) => {
      prompts.push(p.messages[1].content);
      return { content: replies.shift() ?? '' };
    });
    const agentLLM = { providerFor: jest.fn(async () => ({ provider: { chat }, model: 'm', systemPrompt: 's' })) };
    const memory = { getAgentIdByRole: jest.fn(async () => 'a'), saveMemory: jest.fn(async () => 'm') };
    const prisma = { project: { findUnique: jest.fn(async () => ({ ooadMetadata: null })) } };
    const ooad = { buildImplementationContext: jest.fn(async () => '') };
    const quality = new CodeQualityService(new TypeScriptCodeAnalyzer(), workspace);
    const strategy = new DevActionStrategy(memory as any, agentLLM as any, { sendToProject: jest.fn() } as any, prisma as any, ooad as any, workspace, quality);
    const run = () => strategy.act(createMockAgentContext({ projectId, task: 'Implement UC-001' }), { reasoning: '', plannedActions: [], confidence: 1, memories: [] });
    return { prompts, run };
  }
  const block = (content: string) => `<CODE filepath="src/domain/run.ts">\n${content}\n</CODE>`;

  it('refines low-scoring code once and keeps it when the score improves', async () => {
    const { prompts, run } = dev([block(MESSY), block(FIXED)]);
    const out = (await run()).output as DevOutput;

    expect(prompts).toHaveLength(2);
    expect(prompts[1]).toContain('[layering]');
    expect(prompts[1]).toContain('<CODE filepath="src/domain/run.ts">');
    expect(out.codeQuality).toMatchObject({ refined: true, refinedFiles: ['src/domain/run.ts'], score: 100, predictedQaVerdict: 'pass' });
    expect(out.codeQuality!.scoreBefore).toBeLessThan(70);
    expect(await workspace.readFile(projectId, 'src/domain/run.ts')).toBe(FIXED);
    expect(out.code).toContain('return x;');
    expect(out.filesWritten).toEqual([`projects/${projectId}/src/domain/run.ts`]);
    expect(await workspace.readFile(projectId, 'docs/code-quality.md')).toContain('Refined: src/domain/run.ts.');
  });

  it('discards a refinement that does not score higher, and can be switched off', async () => {
    const worse = dev([block(MESSY), block(MESSY + '\nexport const t = () => eval("y");')]);
    const out = (await worse.run()).output as DevOutput;
    expect(out.codeQuality).toMatchObject({ refined: false, refinedFiles: [], predictedQaVerdict: 'fail' });
    expect(await workspace.readFile(projectId, 'src/domain/run.ts')).toBe(MESSY);

    process.env.CODE_QUALITY_REFINE = 'off';
    const off = dev([block(MESSY)]);
    const result = (await off.run()).output as DevOutput;
    expect(off.prompts).toHaveLength(1);
    expect(result.codeQuality).toMatchObject({ scoreBefore: null, refined: false });
  });

  it('clean code is not sent back, and QA receives the static analysis as evidence', async () => {
    const { prompts, run } = dev([block(FIXED)]);
    const out = (await run()).output as DevOutput;
    expect(prompts).toHaveLength(1);
    expect(out.codeQuality).toMatchObject({ score: 100, scoreBefore: null });

    const qaPrompts: string[] = [];
    const chat = jest.fn(async (p: any) => { qaPrompts.push(p.messages[1].content); return { content: 'VERDICT: PASS' }; });
    const qa = new QaActionStrategy(
      { getAgentIdByRole: jest.fn(), saveMemory: jest.fn() } as any,
      { providerFor: jest.fn(async () => ({ provider: { chat }, model: 'm', systemPrompt: 's' })) } as any,
      { sendToProject: jest.fn() } as any,
      { project: { findUnique: jest.fn(async () => null) } } as any
    );
    await qa.act(createMockAgentContext({ projectId, code: out.code, codeQuality: out.codeQuality } as any), { reasoning: '', plannedActions: [], confidence: 1, memories: [] });
    expect(qaPrompts[0]).toContain('STATIC ANALYSIS');
    expect(qaPrompts[0]).toContain('Static analysis score: 100/100');
  });

  it('does not parse a file again while its content is unchanged (Task 28 load test)', () => {
    const analyzer = new TypeScriptCodeAnalyzer();
    const analyze = jest.spyOn(analyzer, 'analyze');
    const quality = new CodeQualityService(analyzer, workspace);
    const file = { path: 'src/domain/run.ts', content: FIXED };

    expect(quality.assessFiles([file]).score).toBe(100);
    expect(quality.assessFiles([file]).score).toBe(100);
    expect(analyze).toHaveBeenCalledTimes(1);
    expect(quality.assessFiles([{ ...file, content: MESSY }]).score).toBeLessThan(70);
    expect(analyze).toHaveBeenCalledTimes(2);
  });

  it('reuses a project\'s assessment until the DEV agent rewrites its code', async () => {
    const quality = new CodeQualityService(new TypeScriptCodeAnalyzer(), workspace);
    await workspace.writeFile(projectId, 'src/domain/run.ts', FIXED);
    expect((await quality.assessProject(projectId, 0)).score).toBe(100);

    await workspace.writeFile(projectId, 'src/domain/run.ts', MESSY);
    expect((await quality.assessProject(projectId, 1_000)).score).toBe(100); // cached
    expect((await quality.assessProject(projectId, 31_000)).score).toBeLessThan(70); // expired

    await workspace.writeFile(projectId, 'src/domain/run.ts', FIXED);
    await quality.writeReport(projectId, quality.assessFiles([]));
    expect((await quality.assessProject(projectId, 32_000)).score).toBe(100); // invalidated by the report
  });
});

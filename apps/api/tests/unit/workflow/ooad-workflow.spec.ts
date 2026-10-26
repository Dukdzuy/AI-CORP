import { Logger } from '@nestjs/common';
import { DEFAULT_WORKFLOW_DEFINITION } from '../../../src/modules/workflow/default-workflow';
import { WorkflowValidator } from '../../../src/modules/workflow/workflow-validator';
import { QualityGateHandler, DEFAULT_OOAD_GATE_CRITERIA } from '../../../src/modules/workflow/handlers/quality-gate.handler';
import { QualityGateStrategy } from '../../../src/modules/workflow/strategies/quality-gate.strategy';
import { AgentTaskStrategy } from '../../../src/modules/workflow/strategies/agent-task.strategy';
import { UsageTrackingLLMProvider } from '../../../src/modules/llm/usage-tracking.provider';

describe('Default OOAD workflow', () => {
  const def = DEFAULT_WORKFLOW_DEFINITION;
  const next = (from: string, condition?: string) =>
    def.edges.find(e => e.from === from && e.condition === condition)?.to;

  it('is a valid workflow definition', () => {
    expect(() => WorkflowValidator.validate(def)).not.toThrow();
  });

  it('runs analysis and design before planning and implementation', () => {
    const path: string[] = [];
    let node: string | undefined = def.startNode;
    while (node && node !== def.endNode) {
      path.push(node);
      node = next(node) || next(node, 'onSuccess') || next(node, 'onApprove');
    }
    const roles = path.map(id => def.nodes.find(n => n.id === id)!).map(n => n.agentRole || n.type);
    expect(roles).toEqual([
      'CEO', 'BA', 'ARCHITECT', 'quality_gate', 'PM', 'DEV', 'QC', 'QA', 'condition', 'MARKETING', 'human_approval',
    ]);
  });

  it('loops back to the Architect when the OOAD gate fails and to DEV when QA rejects', () => {
    expect(next('ooad_gate', 'onFail')).toBe('design');
    expect(next('qa_condition', 'onFail')).toBe('develop');
  });

  it('has no DevOps step', () => {
    expect(def.nodes.some(n => (n.agentRole as string) === 'DEVOPS')).toBe(false);
  });
});

describe('QualityGateHandler', () => {
  const metadata = {
    useCases: [1, 2, 3, 4, 5],
    domainModel: { entities: [1, 2, 3] },
    patterns: [1, 2, 3],
  };
  const setup = (ooadMetadata: any, existing: string[]) => {
    const prisma = {
      project: { findUnique: jest.fn().mockResolvedValue({ ooadMetadata }) },
      qualityGateLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const workspace = { exists: jest.fn(async (_id: string, p: string) => existing.includes(p)) };
    const ws = { sendToProject: jest.fn() };
    return { handler: new QualityGateHandler(prisma as any, workspace as any, ws as any), prisma, ws };
  };
  const allDocs = DEFAULT_OOAD_GATE_CRITERIA.requiredArtifacts.map(a => `docs/${a}`);

  it('passes when counts are met and every artifact is in the workspace', async () => {
    const { handler, prisma, ws } = setup(metadata, allDocs);
    const result = await handler.executeGate('p1', 'ooad_gate');

    expect(result.passed).toBe(true);
    expect(result.score).toBe(100);
    expect(prisma.qualityGateLog.create).toHaveBeenCalledWith({ data: expect.objectContaining({ passed: true, gateId: 'ooad_gate' }) });
    expect(ws.sendToProject).toHaveBeenCalledWith('p1', expect.objectContaining({ type: 'quality_gate_result' }));
  });

  it('fails with a checklist when use cases or artifacts are missing', async () => {
    const { handler } = setup({ ...metadata, useCases: [1, 2] }, allDocs.slice(1));
    const result = await handler.executeGate('p1', 'ooad_gate');

    expect(result.passed).toBe(false);
    const failing = result.checklist.filter(c => !c.passed).map(c => c.name);
    expect(failing).toEqual(['Use cases count', 'Artifact: use-cases.md']);
  });
});

describe('QualityGateStrategy', () => {
  const ctx = { logger: new Logger('test') } as any;
  const run = { id: 'r1', projectId: 'p1' } as any;

  it('registers itself with the engine and maps the gate result to an edge condition', async () => {
    const engine = { registerStrategy: jest.fn() };
    const handler = { executeGate: jest.fn().mockResolvedValue({ passed: false, checklist: [], score: 50 }) };
    const strategy = new QualityGateStrategy(engine as any, handler as any);
    strategy.onModuleInit();
    expect(engine.registerStrategy).toHaveBeenCalledWith(strategy);

    const node = { id: 'ooad_gate', type: 'quality_gate', metadata: { criteria: { minUseCases: 8 } } } as any;
    const result = await strategy.execute(node, run, ctx);

    expect(handler.executeGate).toHaveBeenCalledWith('p1', 'ooad_gate', expect.objectContaining({ minUseCases: 8, minEntities: 3 }));
    expect(result).toEqual({ status: 'success', output: expect.objectContaining({ passed: false, edgeCondition: 'onFail' }) });
  });
});

describe('AgentTaskStrategy.unwrapActionOutput', () => {
  it('reads both strategy results and legacy agent results', () => {
    expect(AgentTaskStrategy.unwrapActionOutput({ success: true, output: { action: 'review', qa_approved: false } }))
      .toEqual({ action: 'review', qa_approved: false });
    expect(AgentTaskStrategy.unwrapActionOutput({ success: true, output: 'text' })).toEqual({ output: 'text' });
    expect(AgentTaskStrategy.unwrapActionOutput({ action: 'planMilestones', output: '1. A' }))
      .toEqual({ action: 'planMilestones', output: '1. A' });
    expect(AgentTaskStrategy.unwrapActionOutput(undefined)).toBeNull();
  });
});

describe('UsageTrackingLLMProvider', () => {
  it('forwards the call and logs tokens against the agent and project', async () => {
    const result = {
      content: 'ok', requestedModel: 'm', actualModelUsed: 'm2', actualProvider: 'opencode', isFallbackTriggered: false,
      tokenUsage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
    };
    const inner = { chat: jest.fn().mockResolvedValue(result), validateConfig: jest.fn(), getProviderName: () => 'inner' };
    const usage = { logUsage: jest.fn().mockResolvedValue(undefined) };
    const provider = new UsageTrackingLLMProvider(inner as any, usage as any, { agentRole: 'BA', projectId: 'p1' });

    await expect(provider.chat({ model: 'm', messages: [] } as any)).resolves.toBe(result);
    expect(usage.logUsage).toHaveBeenCalledWith(expect.objectContaining({
      agentRole: 'BA', projectId: 'p1', requestedModel: 'm', actualModelUsed: 'm2', promptTokens: 10, completionTokens: 5,
    }));
    expect(provider.getProviderName()).toBe('inner');
  });
});

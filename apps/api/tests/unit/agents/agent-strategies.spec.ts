import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { AgentRole } from '@ai-corp/shared-types';
import { TemplateService } from '../../../src/modules/agents/services/template.service';
import { OOADArtifactService } from '../../../src/modules/agents/services/ooad-artifact.service';
import { JestReportMapper } from '../../../src/modules/agents/services/jest-report.mapper';
import { TraceabilityService } from '../../../src/modules/agents/services/traceability.service';
import { ProjectWorkspace } from '../../../src/modules/workspace/project-workspace.service';
import { ROLE_PROFILES, RoleProfile } from '../../../src/modules/agents/profiles';
import {
  CeoThinkingStrategy, CeoActionStrategy,
  BAThinkingStrategy, BAActionStrategy,
  ArchitectThinkingStrategy, ArchitectActionStrategy,
  PmThinkingStrategy, PmActionStrategy,
  DevThinkingStrategy, DevActionStrategy,
  QcThinkingStrategy, QcActionStrategy,
  QaThinkingStrategy, QaActionStrategy,
  MarketingThinkingStrategy, MarketingActionStrategy,
} from '../../../src/modules/agents/strategies';
import { AgentContext, AgentThought } from '../../../src/domain/common/types';
import { ArchitectOutput, BaOutput, DevOutput } from '../../../src/domain/agent/AgentOutputs';
import { architecture, domainModel, patterns, useCaseData } from './ooad-fixtures';
import { createMockAgentContext } from '../../utils';

/** Mocked collaborators shared by the strategies; the LLM records every prompt it receives */
function harness(replies: string[] = []) {
  const prompts: Array<{ system: string; user: string; model: string }> = [];
  const chat = jest.fn(async (params: any) => {
    prompts.push({
      system: params.messages.find((m: any) => m.role === 'system')?.content,
      user: params.messages.find((m: any) => m.role === 'user')?.content,
      model: params.model,
    });
    return { content: replies.length > 1 ? replies.shift() : replies[0] ?? 'ok' };
  });
  const agentLLM = {
    providerFor: jest.fn(async (profile: RoleProfile) => ({ provider: { chat }, model: profile.defaultModel.model, systemPrompt: profile.systemPrompt })),
  };
  const memory = {
    recall: jest.fn().mockResolvedValue(['past lesson']),
    getAgentIdByRole: jest.fn().mockResolvedValue('agent-1'),
    saveMemory: jest.fn().mockResolvedValue('m-1'),
  };
  const ws = { sendToProject: jest.fn(), broadcastEvent: jest.fn() };
  let metadata: any = {};
  const prisma = {
    project: {
      findUnique: jest.fn(async () => ({ ooadMetadata: metadata })),
      update: jest.fn(async ({ data }: any) => { metadata = data.ooadMetadata; return {}; }),
    },
  };
  return {
    prompts, chat, agentLLM, memory, ws, prisma,
    setMetadata: (m: any) => { metadata = m; },
    metadata: () => metadata,
  };
}

const thought: AgentThought = { reasoning: 'r', plannedActions: [], confidence: 1, memories: ['past lesson'] };
const ctx = (overrides: Partial<AgentContext> = {}): AgentContext =>
  createMockAgentContext({ goal: 'Online shop', projectName: 'Shop', ...overrides });
const profileOf = (role: AgentRole) => ROLE_PROFILES.find(p => p.role === role)!;

describe('Thinking strategies', () => {
  const cases: Array<[AgentRole, new (m: any) => { think(c: AgentContext): Promise<AgentThought> }]> = [
    [AgentRole.CEO, CeoThinkingStrategy],
    [AgentRole.BA, BAThinkingStrategy],
    [AgentRole.ARCHITECT, ArchitectThinkingStrategy],
    [AgentRole.PM, PmThinkingStrategy],
    [AgentRole.DEV, DevThinkingStrategy],
    [AgentRole.QC, QcThinkingStrategy],
    [AgentRole.QA, QaThinkingStrategy],
    [AgentRole.MARKETING, MarketingThinkingStrategy],
  ];

  it.each(cases)('%s recalls memories from its profile namespace and plans an action', async (role, Strategy) => {
    const { memory } = harness();
    const result = await new Strategy(memory).think(ctx());

    expect(memory.recall).toHaveBeenCalledWith(role, profileOf(role).primaryNamespace, expect.any(String), expect.any(Number));
    expect(result.reasoning.length).toBeGreaterThan(0);
    expect(result.plannedActions.length).toBeGreaterThan(0);
    expect(result.confidence).toBeGreaterThan(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
    expect(result.memories).toEqual(['past lesson']);
  });

  it('QA reads the same namespace QA writes to', async () => {
    const { memory } = harness();
    await new QaThinkingStrategy(memory as any).think(ctx());
    expect(memory.recall.mock.calls[0][1]).toBe('review_checklist');
  });

  it('CEO thinking follows the task type', async () => {
    const { memory } = harness();
    const close = await new CeoThinkingStrategy(memory as any).think(ctx({ taskType: 'complete_project' }));
    expect(close.plannedActions[0].rationale).toMatch(/close-out/);
  });
});

describe('Action strategies', () => {
  let workspaceDir: string;
  let workspace: ProjectWorkspace;
  let ooad: OOADArtifactService;
  const projectId = 'project-456';

  beforeAll(() => {
    process.env.OOAD_TEMPLATES_PATH = path.join(__dirname, '../../../src/modules/agents/templates/ooad');
  });
  beforeEach(() => {
    workspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'strategies-ws-'));
    workspace = new ProjectWorkspace(workspaceDir);
    ooad = new OOADArtifactService(new TemplateService(), workspace);
  });
  afterEach(() => fs.rmSync(workspaceDir, { recursive: true, force: true }));

  const design = { useCases: useCaseData.useCases, actors: useCaseData.actors, domainModel, architecture, patterns };

  it('every strategy uses its role profile for the model and system prompt', async () => {
    const h = harness();
    await new MarketingActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any).act(ctx(), thought);
    expect(h.agentLLM.providerFor).toHaveBeenCalledWith(profileOf(AgentRole.MARKETING), projectId);
    expect(h.prompts[0].system).toBe(profileOf(AgentRole.MARKETING).systemPrompt);
    expect(h.prompts[0].model).toBe('openrouter/openrouter/owl-alpha');
  });

  describe('CEO', () => {
    it('plans milestones by default and writes a close-out report for complete_project', async () => {
      const h = harness(['1. MVP - first release']);
      const strategy = new CeoActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any);

      const plan = await strategy.act(ctx({ taskType: 'planMilestones' }), thought);
      expect(plan.output).toEqual({ action: 'planMilestones', output: '1. MVP - first release' });
      expect(h.prompts[0].user).toContain('PROJECT GOAL: Test project goal');
      expect(h.prompts[0].user).toContain('past lesson');

      const close = await strategy.act(ctx({ taskType: 'complete_project' }), thought);
      expect(close.output!.action).toBe('complete_project');
      expect(h.prompts[1].user).toContain('close-out report');
      expect(h.memory.saveMemory).toHaveBeenLastCalledWith('agent-1', 'CEO', 'strategy', expect.stringContaining('Closed project'), expect.anything());
    });
  });

  describe('BA', () => {
    it('validates the use cases, writes the use case docs and stores the metadata', async () => {
      const h = harness([JSON.stringify(useCaseData)]);
      const strategy = new BAActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, ooad, h.prisma as any);

      const result = await strategy.act(ctx(), thought);

      expect(h.prompts[0].user).toContain('PROJECT GOAL: Online shop');
      expect(h.prompts[0].user).toContain('past lesson');
      expect(result.output).toEqual(expect.objectContaining({ action: 'generateUseCases', actors: ['Customer', 'Store Admin'] }));
      expect((result.output as BaOutput).useCases).toHaveLength(5);
      expect((result.output as BaOutput).filesWritten).toEqual(expect.arrayContaining([`projects/${projectId}/docs/use-cases.md`, `projects/${projectId}/docs/use-case-diagram.puml`]));
      expect(await workspace.exists(projectId, 'docs/use-cases.md')).toBe(true);
      expect(h.metadata().useCases).toHaveLength(5);
    });

    it('rejects use cases that do not match the OOAD schema', async () => {
      const h = harness([JSON.stringify({ actors: ['A'], useCases: [] })]);
      const strategy = new BAActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, ooad, h.prisma as any);
      await expect(strategy.act(ctx(), thought)).rejects.toThrow(/UseCaseData/);
    });
  });

  describe('Architect', () => {
    const sequence = JSON.stringify({
      participants: [{ name: 'Customer', kind: 'actor' }, { name: 'OrderController', kind: 'boundary' }],
      messages: [
        { from: 'Customer', to: 'OrderController', label: 'placeOrder()' },
        { from: 'OrderController', to: 'Customer', label: 'orderId', kind: 'reply' },
        { from: 'Customer', to: 'OrderController', label: 'confirm()' },
      ],
    });

    it('designs from the stored use cases and writes diagrams plus the layered skeleton', async () => {
      const h = harness([JSON.stringify(domainModel), JSON.stringify({ patterns }), JSON.stringify(architecture), sequence, sequence, sequence]);
      h.setMetadata({ useCases: useCaseData.useCases, actors: useCaseData.actors });
      const strategy = new ArchitectActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, ooad, h.prisma as any);

      const result = await strategy.act(ctx(), thought);

      expect(h.prompts[0].user).toContain('UC-001');
      expect(h.prompts[0].user).toContain('past lesson');
      expect(h.prompts[3].user).toContain('USE CASE: Place Order (UC-001)');
      expect(result.output!.action).toBe('designArchitecture');
      expect((result.output as ArchitectOutput).domainModel.entities.map(e => e.name)).toEqual(['Order', 'Product', 'Payment']);
      expect((result.output as ArchitectOutput).skeletonFiles.some(f => f.startsWith('src/domain/'))).toBe(true);
      expect(await workspace.exists(projectId, 'docs/class-diagram.puml')).toBe(true);
      expect(h.metadata()).toEqual(expect.objectContaining({ useCases: expect.any(Array), patterns: expect.any(Array) }));
    });

    it('refuses to design before the BA has written use cases', async () => {
      const h = harness();
      const strategy = new ArchitectActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, ooad, h.prisma as any);
      await expect(strategy.act(ctx(), thought)).rejects.toThrow(/BA Agent has not completed use case analysis/);
    });
  });

  describe('PM', () => {
    it('plans one task per approved use case, highest priority first', async () => {
      const h = harness(['1. UC-001 Place order']);
      h.setMetadata({ useCases: useCaseData.useCases });
      const result = await new PmActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, h.prisma as any).act(ctx(), thought);

      const prompt = h.prompts[0].user;
      expect(prompt).toContain('approved by the OOAD quality gate');
      expect(prompt.indexOf('UC-004')).toBeLessThan(prompt.indexOf('UC-003'));
      expect(prompt.indexOf('UC-003')).toBeLessThan(prompt.indexOf('UC-005'));
      expect(result.output).toEqual({ action: 'breakdownTasks', output: '1. UC-001 Place order' });
    });

    it('falls back to milestone breakdown without use cases', async () => {
      const h = harness(['1. Task']);
      await new PmActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, h.prisma as any).act(ctx({ milestone: 'MVP' }), thought);
      expect(h.prompts[0].user).toContain('MILESTONE: MVP');
    });
  });

  describe('DEV', () => {
    it('receives the OOAD design and writes only safe paths to the workspace', async () => {
      const llm = [
        '<CODE filepath="src/application/services/OrderService.ts">',
        '// UC-001: Place Order',
        'export class OrderService {}',
        '</CODE>',
        '<CODE filepath="../../etc/evil.ts">',
        'bad',
        '</CODE>',
      ].join('\n');
      const h = harness([llm]);
      h.setMetadata(design);
      const strategy = new DevActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, h.prisma as any, ooad, workspace);

      const result = await strategy.act(ctx({ task: 'Implement UC-001' }), thought);

      expect(h.prompts[0].user).toContain('STRICTLY FOLLOW THE OOAD DESIGN');
      expect(h.prompts[0].user).toContain('UC-001');
      expect(result.output).toEqual(expect.objectContaining({
        action: 'implement',
        filesWritten: [`projects/${projectId}/src/application/services/OrderService.ts`],
      }));
      expect((result.output as DevOutput).code).toContain('export class OrderService');
      expect(await workspace.readFile(projectId, 'src/application/services/OrderService.ts')).toContain('UC-001');
    });
  });

  describe('QC', () => {
    const runner = { run: jest.fn() };
    beforeEach(() => runner.run.mockResolvedValue(JestReportMapper.notExecuted('Docker is not available')));

    it('writes acceptance tests for untested use cases and reports coverage', async () => {
      const tests = useCaseData.useCases
        .slice(0, 4)
        .map(uc => `<CODE filepath="tests/${uc.id}.spec.ts">\ndescribe('${uc.id}: ${uc.name}', () => { it('main flow', () => {}); });\n</CODE>`)
        .join('\n');
      const h = harness([tests]);
      h.setMetadata(design);
      await workspace.writeFile(projectId, 'src/application/services/OrderService.ts', '// UC-001: Place Order\nexport class OrderService {}');
      const strategy = new QcActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, h.prisma as any, workspace, new TraceabilityService(), runner as any);

      const result = await strategy.act(ctx(), thought);

      expect(h.prompts[0].user).toContain('UC-001');
      expect(h.prompts[0].user).toContain('OrderService');
      expect(result.output).toEqual(expect.objectContaining({ action: 'verify', testCoverage: 80, qc_passed: true, missingUseCases: ['UC-005'] }));
      expect(result.output!.testsWritten).toHaveLength(4);
      expect(await workspace.exists(projectId, 'docs/traceability-matrix.md')).toBe(true);
      expect(h.metadata().testCoverage).toBe(80);
      expect(result.output!.testsExecuted).toBe(false);
      expect(await workspace.readFile(projectId, 'docs/traceability-matrix.md')).toContain('Tests not executed: Docker is not available');
    });

    it('runs the tests and fails QC when a High-priority use case fails', async () => {
      const h = harness();
      h.setMetadata(design);
      for (const uc of useCaseData.useCases) {
        await workspace.writeFile(projectId, `tests/${uc.id}.spec.ts`, `describe('${uc.id}: ${uc.name}', () => { it('main flow', () => {}); });`);
      }
      const byUseCase = Object.fromEntries(useCaseData.useCases.map(uc => [uc.id, { useCaseId: uc.id, passed: 1, failed: 0, failingTests: [] as string[] }]));
      byUseCase['UC-001'] = { useCaseId: 'UC-001', passed: 0, failed: 1, failingTests: ['UC-001: Place Order main flow: expected 1, received 0'] };
      runner.run.mockResolvedValue({ executed: true, passed: 4, failed: 1, total: 5, byUseCase, unmappedFailures: [], mode: 'local' });
      const strategy = new QcActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, h.prisma as any, workspace, new TraceabilityService(), runner as any);

      const result = await strategy.act(ctx(), thought);

      expect(h.prompts).toHaveLength(0); // every use case already has a test
      expect(runner.run).toHaveBeenCalledWith(projectId, expect.arrayContaining([expect.objectContaining({ id: 'UC-001' })]));
      expect(result.output).toEqual(expect.objectContaining({
        testsExecuted: true,
        testCoverage: 80,
        qc_passed: false,
        failingUseCases: ['UC-001'],
        failingTests: ['UC-001: UC-001: Place Order main flow: expected 1, received 0'],
      }));
      expect(h.metadata().traceability).toEqual(expect.objectContaining({ executed: true, passingCount: 4, failingCount: 1, testsPassed: 4, testsFailed: 1 }));
      expect(h.ws.sendToProject).toHaveBeenCalledWith(projectId, expect.objectContaining({
        type: 'quality_warning',
        payload: expect.objectContaining({ failingUseCases: ['UC-001'] }),
      }));
    });

    it('fails without a project', async () => {
      const h = harness();
      const strategy = new QcActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, h.prisma as any, workspace, new TraceabilityService(), runner as any);
      const result = await strategy.act(ctx({ projectId: 'unknown' }), thought);
      expect(result).toEqual({ success: false, output: null, error: 'QC needs a project to verify' });
    });
  });

  describe('QA', () => {
    it('reviews against the design and the QC report and returns the verdict', async () => {
      const h = harness(['Findings...\nVERDICT: FAIL']);
      h.setMetadata(design);
      const strategy = new QaActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, h.prisma as any);

      const result = await strategy.act(ctx({
        code: 'export class OrderService {}',
        qcReport: 'Missing tests for: UC-005',
        failingTests: ['UC-001: Place Order main flow: expected 1, received 0'],
      }), thought);

      expect(h.prompts[0].user).toContain('Entities: Order, Product, Payment');
      expect(h.prompts[0].user).toContain('Missing tests for: UC-005');
      expect(h.prompts[0].user).toContain('FAILING TESTS (executed by QC):\n- UC-001: Place Order main flow');
      expect(result.output).toEqual(expect.objectContaining({ action: 'review', qa_approved: false, edgeCondition: 'onFail' }));
      expect(h.memory.saveMemory).toHaveBeenCalledWith('agent-1', 'QA', 'review_checklist', expect.any(String), expect.anything());
    });
  });

  describe('Marketing', () => {
    it('drafts the announcement from the project summary', async () => {
      const h = harness(['We are live!']);
      const result = await new MarketingActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any)
        .act(ctx({ projectSummary: 'A shop for books' }), thought);
      expect(h.prompts[0].user).toContain('PROJECT: A shop for books');
      expect(result.output).toEqual({ action: 'draftAnnouncement', output: 'We are live!' });
    });
  });

  describe('Collaboration task types (Task 15)', () => {
    it('DEV plans before coding and turns ambiguous use cases into questions', async () => {
      const h = harness(['1. UC-001 -> OrderService (application), Order (domain)\nQUESTION: UC-002: can a guest pay?\nQUESTION: none']);
      h.setMetadata(design);
      const strategy = new DevActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, h.prisma as any, ooad, workspace);

      const result = await strategy.act(ctx({ taskType: 'planImplementation', designFeedback: 'Put Order in the domain layer' }), thought);

      expect(h.prompts[0].user).toContain('propose an implementation plan');
      expect(h.prompts[0].user).toContain('ARCHITECT FEEDBACK');
      expect(result.output).toEqual({
        action: 'planImplementation',
        output: '1. UC-001 -> OrderService (application), Order (domain)',
        implementationPlan: '1. UC-001 -> OrderService (application), Order (domain)',
        questions: ['UC-002: can a guest pay?'],
      });
      expect(await workspace.listFiles(projectId)).toEqual([]);
    });

    it('DEV implements with the accepted plan, feedback and BA clarifications in the prompt', async () => {
      const h = harness(['<CODE filepath="src/a.ts">\n// UC-001\nexport const a = 1;\n</CODE>']);
      h.setMetadata(design);
      const strategy = new DevActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, h.prisma as any, ooad, workspace);

      await strategy.act(ctx({ implementationPlan: 'PLAN-X', designFeedback: 'FEEDBACK-Y', clarifications: ['UC-002: guests cannot pay'] }), thought);

      expect(h.prompts[0].user).toContain('IMPLEMENTATION PLAN (accepted by the Architect):\nPLAN-X');
      expect(h.prompts[0].user).toContain('FEEDBACK-Y');
      expect(h.prompts[0].user).toContain('- UC-002: guests cannot pay');
    });

    it('Architect reviews a plan against the design and rejects with feedback', async () => {
      const h = harness(['1. Payment is missing for UC-003\nDECISION: REJECT']);
      h.setMetadata(design);
      const strategy = new ArchitectActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, ooad, h.prisma as any);

      const result = await strategy.act(ctx({ taskType: 'reviewPlan', implementationPlan: 'PLAN-X' }), thought);

      expect(h.prompts[0].user).toContain("DEV'S IMPLEMENTATION PLAN:\nPLAN-X");
      expect(h.prompts[0].user).toContain('Entities: Order, Product, Payment');
      expect(result.output).toEqual({
        action: 'reviewPlan',
        output: '1. Payment is missing for UC-003',
        design_approved: false,
        designFeedback: '1. Payment is missing for UC-003',
      });
      expect(h.chat).toHaveBeenCalledTimes(1);
    });

    it('Architect accepts code and clears the feedback', async () => {
      const h = harness(['Layers are respected.\nDECISION: ACCEPT']);
      h.setMetadata(design);
      const strategy = new ArchitectActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, ooad, h.prisma as any);

      const result = await strategy.act(ctx({ taskType: 'reviewCode', code: 'export class Order {}' }), thought);

      expect(h.prompts[0].user).toContain("DEV'S CODE:\nexport class Order {}");
      expect(result.output).toEqual(expect.objectContaining({ action: 'reviewCode', design_approved: true, designFeedback: '' }));
    });

    it('BA answers a clarification, updates only that use case and keeps the design', async () => {
      const uc2 = useCaseData.useCases[1];
      const updatedUc = { ...uc2, exceptionFlows: [...uc2.exceptionFlows, 'Guest tries to pay: ask them to sign in'] };
      const h = harness([JSON.stringify({ answer: 'Guests must sign in before paying.', useCase: updatedUc })]);
      h.setMetadata(design);
      const strategy = new BAActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, ooad, h.prisma as any);

      const result = await strategy.act(ctx({ taskType: 'clarifyUseCase', clarificationQuestion: `${uc2.id}: can a guest pay?` }), thought);

      expect(h.prompts[0].user).toContain(`"id": "${uc2.id}"`);
      expect(result.output).toEqual({
        action: 'clarifyUseCase',
        output: 'Guests must sign in before paying.',
        clarification: `${uc2.id}: Guests must sign in before paying.`,
        updatedUseCaseId: uc2.id,
      });
      const saved = h.metadata();
      expect(saved.domainModel).toEqual(domainModel);
      expect(saved.patterns).toEqual(patterns);
      expect(saved.useCases[1].exceptionFlows).toContain('Guest tries to pay: ask them to sign in');
      expect(saved.useCases[0]).toEqual(useCaseData.useCases[0]);
      expect(await workspace.readFile(projectId, 'docs/use-cases.md')).toContain('Guest tries to pay');
    });

    it('BA keeps the use case when the update is invalid', async () => {
      const h = harness([JSON.stringify({ answer: 'Yes.', useCase: { name: 'x' } })]);
      h.setMetadata(design);
      const strategy = new BAActionStrategy(h.memory as any, h.agentLLM as any, h.ws as any, ooad, h.prisma as any);

      const result = await strategy.act(ctx({ taskType: 'clarifyUseCase', clarificationQuestion: 'UC-001: anything?' }), thought);

      expect(result.output).toEqual(expect.objectContaining({ clarification: 'UC-001: Yes.' }));
      expect(result.output).not.toHaveProperty('updatedUseCaseId');
      expect(h.prisma.project.update).not.toHaveBeenCalled();
    });
  });
});

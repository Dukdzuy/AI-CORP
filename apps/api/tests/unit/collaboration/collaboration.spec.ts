import { Logger } from '@nestjs/common';
import { AclMessage, AclProtocol, Performative } from '../../../src/domain/collaboration/AclMessage';
import { AgentMessageBus, ALL_ROLES } from '../../../src/modules/orchestrator/agent-message.bus';
import { AgentOrchestratorService } from '../../../src/modules/orchestrator/agent-orchestrator.service';
import { CollaborationContext, TurnOutput } from '../../../src/modules/workflow/collaboration/collaboration-strategy';
import { CollaborationRegistry } from '../../../src/modules/workflow/collaboration/collaboration.registry';
import { PairDevelopCollaboration } from '../../../src/modules/workflow/collaboration/pair-develop.collaboration';
import { ReviewChainCollaboration, ReviewHandler } from '../../../src/modules/workflow/collaboration/review-chain.collaboration';
import { ClarificationLoopCollaboration } from '../../../src/modules/workflow/collaboration/clarification-loop.collaboration';
import { AgentCollaborationStrategy } from '../../../src/modules/workflow/collaboration/agent-collaboration.strategy';
import { DEFAULT_WORKFLOW_DEFINITION, PAIR_WORKFLOW_DEFINITION } from '../../../src/modules/workflow/default-workflow';
import { WorkflowDefinitionService } from '../../../src/modules/workflow/workflow-definition.service';
import { WorkflowValidator } from '../../../src/modules/workflow/workflow-validator';
import { parseQuestions, parseVerdict, stripMarkers, useCaseIdOf } from '../../../src/modules/agents/services/collaboration-replies';

const base = { projectId: 'p1', conversationId: 'c1', content: 'hello' };

function newBus() {
  const persisted: any[] = [];
  const service = { sendMessage: jest.fn(async (params: any) => { persisted.push(params); return params; }) };
  return { bus: new AgentMessageBus(service as any), service, persisted };
}

/**
 * A collaboration context over a real message bus: agent turns are scripted per "ROLE:taskType"
 * and every turn and message is recorded in order.
 */
function scripted(script: Record<string, TurnOutput[]>, options: Record<string, unknown> = {}, vars: Record<string, unknown> = {}) {
  const { bus } = newBus();
  const log: string[] = [];
  const inputs: Array<{ key: string; input: Record<string, unknown> }> = [];
  const ctx: CollaborationContext = {
    projectId: 'p1',
    conversationId: 'conv-1',
    pattern: 'test',
    options,
    variables: () => vars,
    async turn(role, taskType, input = {}) {
      const key = `${role}:${taskType}`;
      Object.assign(vars, input);
      inputs.push({ key, input });
      log.push(`turn ${key}`);
      const queue = script[key];
      if (!queue?.length) throw new Error(`No scripted output for ${key}`);
      const output = queue.length > 1 ? queue.shift()! : queue[0];
      Object.assign(vars, output);
      return output;
    },
    async say(performative, sender, receiver, content, inReplyTo) {
      const message = await bus.send({ performative, sender, receiver, content, projectId: 'p1', conversationId: 'conv-1', inReplyTo: inReplyTo?.id });
      log.push(`${performative} ${sender}->${receiver}`);
      return message;
    },
  };
  return { ctx, log, inputs, vars, bus };
}

describe('AclMessage', () => {
  it('is immutable and builds replies addressed to the sender', () => {
    const request = AclMessage.create({ ...base, performative: Performative.REQUEST, sender: 'DEV', receiver: 'BA' });
    expect(Object.isFrozen(request)).toBe(true);
    expect(request.reply(Performative.INFORM, 'answer')).toEqual(expect.objectContaining({
      sender: 'BA', receiver: 'DEV', inReplyTo: request.id, conversationId: 'c1',
    }));
    expect(request.toString()).toBe('[REQUEST] DEV → BA: hello');
  });

  it('rejects invalid messages', () => {
    expect(() => AclMessage.create({ ...base, performative: 'SHOUT' as any, sender: 'DEV', receiver: 'BA' })).toThrow(/Unknown performative/);
    expect(() => AclMessage.create({ ...base, performative: Performative.INFORM, sender: 'DEV', receiver: 'DEV' })).toThrow(/itself/);
    expect(() => AclMessage.create({ ...base, content: '  ', performative: Performative.INFORM, sender: 'DEV', receiver: 'BA' })).toThrow(/empty/);
    expect(() => AclMessage.create({ ...base, performative: Performative.ACCEPT, sender: 'ARCHITECT', receiver: 'DEV' })).toThrow(/must answer/);
  });

  it('follows the FIPA-style reply protocol', () => {
    expect(AclProtocol.allowsReply(Performative.PROPOSE, Performative.ACCEPT)).toBe(true);
    expect(AclProtocol.allowsReply(Performative.REQUEST, Performative.INFORM)).toBe(true);
    expect(AclProtocol.allowsReply(Performative.REQUEST, Performative.ACCEPT)).toBe(false);
    expect(AclProtocol.allowsReply(Performative.ACCEPT, Performative.INFORM)).toBe(false);
  });
});

describe('AgentMessageBus (Mediator)', () => {
  it('persists each message as an acl AgentMessage and delivers it to the receiver', async () => {
    const { bus, persisted } = newBus();
    const toBa = jest.fn();
    const toQa = jest.fn();
    const everyone = jest.fn();
    bus.on('BA', toBa);
    bus.on('QA', toQa);
    bus.on(ALL_ROLES, everyone);

    const request = await bus.send({ ...base, performative: Performative.REQUEST, sender: 'DEV', receiver: 'BA', protocol: 'clarification_loop' });

    expect(toBa).toHaveBeenCalledWith(request);
    expect(toQa).not.toHaveBeenCalled();
    expect(everyone).toHaveBeenCalledWith(request);
    expect(persisted[0]).toEqual({
      projectId: 'p1',
      fromRole: 'DEV',
      toRole: 'BA',
      message: 'hello',
      messageType: 'acl',
      metadata: { aclId: request.id, performative: 'REQUEST', conversationId: 'c1', inReplyTo: undefined, protocol: 'clarification_loop' },
    });
  });

  it('broadcasts to every other role and stores null as the receiver', async () => {
    const { bus, persisted } = newBus();
    const dev = jest.fn();
    const qa = jest.fn();
    bus.on('DEV', dev);
    bus.on('QA', qa);
    await bus.send({ ...base, performative: Performative.INFORM, sender: 'DEV', receiver: 'all' });
    expect(qa).toHaveBeenCalledTimes(1);
    expect(dev).not.toHaveBeenCalled();
    expect(persisted[0].toRole).toBeNull();
  });

  it('validates replies against the conversation', async () => {
    const { bus } = newBus();
    const proposal = await bus.send({ ...base, performative: Performative.PROPOSE, sender: 'DEV', receiver: 'ARCHITECT' });
    const request = await bus.send({ ...base, performative: Performative.REQUEST, sender: 'DEV', receiver: 'BA' });

    await expect(bus.send({ ...base, performative: Performative.ACCEPT, sender: 'BA', receiver: 'DEV', inReplyTo: request.id }))
      .rejects.toThrow(/ACCEPT is not a valid answer to REQUEST/);
    await expect(bus.send({ ...base, performative: Performative.ACCEPT, sender: 'QA', receiver: 'DEV', inReplyTo: proposal.id }))
      .rejects.toThrow(/QA cannot answer a message addressed to ARCHITECT/);
    await expect(bus.send({ ...base, performative: Performative.ACCEPT, sender: 'ARCHITECT', receiver: 'DEV', inReplyTo: 'nope' }))
      .rejects.toThrow(/unknown message nope/);
    await expect(bus.send({ ...base, conversationId: 'other', performative: Performative.ACCEPT, sender: 'ARCHITECT', receiver: 'DEV', inReplyTo: proposal.id }))
      .rejects.toThrow(/unknown message/);

    const accept = await bus.send({ ...base, performative: Performative.ACCEPT, sender: 'ARCHITECT', receiver: 'DEV', inReplyTo: proposal.id });
    expect(bus.conversation('c1').map(m => m.performative)).toEqual(['PROPOSE', 'REQUEST', 'ACCEPT']);
    expect(accept.inReplyTo).toBe(proposal.id);

    bus.endConversation('c1');
    expect(bus.conversation('c1')).toEqual([]);
  });

  it('keeps working when persistence or a listener fails', async () => {
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const bus = new AgentMessageBus({ sendMessage: jest.fn().mockRejectedValue(new Error('db down')) } as any);
    const after = jest.fn();
    bus.on('BA', () => { throw new Error('listener bug'); });
    bus.on('BA', after);
    await expect(bus.send({ ...base, performative: Performative.REQUEST, sender: 'DEV', receiver: 'BA' })).resolves.toBeInstanceOf(AclMessage);
    expect(after).toHaveBeenCalled();
  });

  it('summarises agent results in one line for the INFORM the orchestrator sends', () => {
    expect(AgentOrchestratorService.summarize({ success: true, output: { action: 'implement', toolOutput: 'Wrote 2 file(s): a, b', output: 'code' } }))
      .toBe('Completed implement: Wrote 2 file(s): a, b');
    expect(AgentOrchestratorService.summarize({ action: 'planMilestones', output: '\n# Plan\n1. MVP' })).toBe('Completed planMilestones: # Plan');
    expect(AgentOrchestratorService.summarize({ success: true, output: { action: 'x', output: 'y'.repeat(300) } })).toHaveLength('Completed x: '.length + 200);
  });
});

describe('Reply parsers', () => {
  it('reads the verdict marker, defaulting to accept', () => {
    expect(parseVerdict('fine\nDECISION: ACCEPT')).toBe(true);
    expect(parseVerdict('**DECISION:** REJECT')).toBe(false);
    expect(parseVerdict('VERDICT: PASS\n...\nDECISION: REJECT')).toBe(false);
    expect(parseVerdict('no marker')).toBe(true);
  });

  it('reads questions and use case ids, and strips markers', () => {
    const text = 'plan\nQUESTION: UC-002: guest checkout?\n- QUESTION: uc-005: refunds?\nQUESTION: none';
    expect(parseQuestions(text)).toEqual(['UC-002: guest checkout?', 'uc-005: refunds?']);
    expect(useCaseIdOf('uc-005: refunds?')).toBe('UC-005');
    expect(useCaseIdOf('general question')).toBeUndefined();
    expect(stripMarkers(text)).toBe('plan');
  });
});

describe('pair_develop', () => {
  const plan = (text: string, questions: string[] = []) => ({ action: 'planImplementation', output: text, implementationPlan: text, questions });
  const impl = (code: string) => ({ action: 'implement', output: code, code, filesWritten: ['projects/p1/src/a.ts'], toolOutput: 'Wrote 1 file(s)' });
  const review = (approved: boolean, text: string) => ({ action: 'review', output: text, design_approved: approved, designFeedback: approved ? '' : text });

  it('clarifies, revises a rejected plan, implements and gets the code accepted', async () => {
    const { ctx, log, inputs } = scripted({
      'DEV:planImplementation': [plan('plan v1', ['UC-002: guest checkout?']), plan('plan v2'), plan('plan v3')],
      'BA:clarifyUseCase': [{ action: 'clarifyUseCase', output: 'No guests.', clarification: 'UC-002: No guests.', updatedUseCaseId: 'UC-002' }],
      'ARCHITECT:reviewPlan': [review(false, 'Payment belongs in the domain'), review(true, 'Good plan')],
      'DEV:implement': [impl('export class Order {}')],
      'ARCHITECT:reviewCode': [review(true, 'Layers respected')],
    });

    const result = await new PairDevelopCollaboration().run(ctx);

    expect(log).toEqual([
      'turn DEV:planImplementation',
      'REQUEST DEV->BA',
      'turn BA:clarifyUseCase',
      'INFORM BA->DEV',
      'turn DEV:planImplementation',
      'PROPOSE DEV->ARCHITECT',
      'turn ARCHITECT:reviewPlan',
      'REJECT ARCHITECT->DEV',
      'turn DEV:planImplementation',
      'PROPOSE DEV->ARCHITECT',
      'turn ARCHITECT:reviewPlan',
      'ACCEPT ARCHITECT->DEV',
      'turn DEV:implement',
      'INFORM DEV->ARCHITECT',
      'turn ARCHITECT:reviewCode',
      'ACCEPT ARCHITECT->DEV',
    ]);
    expect(inputs.find(i => i.key === 'BA:clarifyUseCase')!.input).toEqual({ clarificationQuestion: 'UC-002: guest checkout?' });
    expect(inputs[2].input).toEqual({ clarifications: ['UC-002: No guests.'], designFeedback: '' });
    expect(inputs[4].input).toEqual({ designFeedback: 'Payment belongs in the domain' });
    expect(inputs.find(i => i.key === 'DEV:implement')!.input).toEqual({ implementationPlan: 'plan v3', designFeedback: '' });
    expect(result.edgeCondition).toBeUndefined();
    expect(result.output).toEqual(expect.objectContaining({
      action: 'implement',
      code: 'export class Order {}',
      implementationPlan: 'plan v3',
      clarifications: ['UC-002: No guests.'],
      planAccepted: true,
      codeAccepted: true,
      navigatorReviews: 3,
    }));
  });

  it('sends rejected code back to DEV and stops after maxRounds', async () => {
    const { ctx, log, inputs } = scripted({
      'DEV:planImplementation': [plan('plan')],
      'ARCHITECT:reviewPlan': [review(false, 'still wrong')],
      'DEV:implement': [impl('v1'), impl('v2')],
      'ARCHITECT:reviewCode': [review(false, 'domain imports Prisma'), review(false, 'still imports Prisma')],
    }, { maxRounds: 2 });

    const result = await new PairDevelopCollaboration().run(ctx);

    expect(log.filter(l => l.startsWith('REJECT'))).toHaveLength(4);
    expect(log.filter(l => l === 'turn DEV:implement')).toHaveLength(2);
    expect(inputs.filter(i => i.key === 'DEV:implement')[1].input).toEqual({ implementationPlan: 'plan', designFeedback: 'domain imports Prisma' });
    expect(result.output).toEqual(expect.objectContaining({ code: 'v2', planAccepted: false, codeAccepted: false, designFeedback: 'still imports Prisma' }));
  });

  it('can skip the code review', async () => {
    const { ctx, log } = scripted({
      'DEV:planImplementation': [plan('plan')],
      'ARCHITECT:reviewPlan': [review(true, 'ok')],
      'DEV:implement': [impl('v1')],
    }, { reviewCode: false });
    const result = await new PairDevelopCollaboration().run(ctx);
    expect(log[log.length - 1]).toBe('INFORM DEV->ARCHITECT');
    expect(result.output).not.toHaveProperty('codeAccepted');
  });
});

describe('review_chain (Chain of Responsibility)', () => {
  const qc = (passed: boolean) => ({ action: 'verify', output: 'coverage 80%', qcReport: 'QC report', qc_passed: passed, failingTests: passed ? [] : ['UC-001: places order: expected 1'] });
  const qa = (approved: boolean) => ({ action: 'review', output: approved ? 'VERDICT: PASS' : 'VERDICT: FAIL', qa_approved: approved });

  it('passes QC findings to QA, whose verdict decides', async () => {
    const { ctx, log } = scripted({ 'QC:verify': [qc(false)], 'QA:review': [qa(true)] }, {}, { filesWritten: ['a.ts'] });

    const result = await new ReviewChainCollaboration().run(ctx);

    expect(log).toEqual([
      'PROPOSE DEV->QC',
      'turn QC:verify',
      'REJECT QC->DEV',
      'PROPOSE QC->QA',
      'turn QA:review',
      'ACCEPT QA->QC',
    ]);
    expect(result).toEqual({
      output: {
        review_approved: true,
        qa_approved: true,
        rejectedBy: ['QC'],
        reviews: [{ role: 'QC', approved: false, decides: false }, { role: 'QA', approved: true, decides: true }],
      },
      edgeCondition: 'onSuccess',
    });
  });

  it('fails when QA rejects', async () => {
    const { ctx } = scripted({ 'QC:verify': [qc(true)], 'QA:review': [qa(false)] });
    const result = await new ReviewChainCollaboration().run(ctx);
    expect(result.edgeCondition).toBe('onFail');
    expect(result.output).toEqual(expect.objectContaining({ qa_approved: false, rejectedBy: ['QA'] }));
  });

  it('takes extra reviewers from metadata and stops at the first deciding rejection', async () => {
    const { ctx, log } = scripted(
      { 'ARCHITECT:reviewCode': [{ action: 'reviewCode', output: 'domain imports Prisma', design_approved: false }], 'QC:verify': [qc(true)], 'QA:review': [qa(true)] },
      { reviewers: [{ role: 'ARCHITECT', taskType: 'reviewCode', verdictField: 'design_approved' }, { role: 'QC' }, { role: 'QA' }] }
    );

    const result = await new ReviewChainCollaboration().run(ctx);

    expect(log).toEqual(['PROPOSE DEV->ARCHITECT', 'turn ARCHITECT:reviewCode', 'REJECT ARCHITECT->DEV']);
    expect(result.edgeCondition).toBe('onFail');
    expect(result.output.rejectedBy).toEqual(['ARCHITECT']);
  });

  it('summarises QC figures and reviewer findings for the Meeting Room', () => {
    expect(ReviewHandler.summarize({ testCoverage: 80, testsExecuted: true, failingUseCases: [], missingUseCases: ['UC-005'], output: '# table' }))
      .toBe('Coverage 80% (tests executed); failing: none; missing: UC-005.');
    expect(ReviewHandler.summarize({ output: '1. Layers respected\nVERDICT: PASS' })).toBe('1. Layers respected');
  });

  it('rejects a reviewer without a task type', () => {
    expect(() => ReviewChainCollaboration.reviewers([{ role: 'PM' }])).toThrow(/needs a role and a taskType/);
    expect(ReviewChainCollaboration.reviewers(undefined).map(r => r.role)).toEqual(['QC', 'QA']);
  });
});

describe('clarification_loop', () => {
  const answer = (text: string) => ({ action: 'clarifyUseCase', output: text, clarification: text });

  it('asks BA each open question and keeps earlier clarifications', async () => {
    const { ctx, log } = scripted(
      { 'BA:clarifyUseCase': [answer('UC-001: yes'), answer('UC-004: no')] },
      { asker: 'QC' },
      { questions: ['UC-001: retries?', 'UC-004: refunds?'], clarifications: ['UC-009: old answer'] }
    );

    const result = await new ClarificationLoopCollaboration().run(ctx);

    expect(log).toEqual(['REQUEST QC->BA', 'turn BA:clarifyUseCase', 'INFORM BA->QC', 'REQUEST QC->BA', 'turn BA:clarifyUseCase', 'INFORM BA->QC']);
    expect(result.output).toEqual({ clarifications: ['UC-009: old answer', 'UC-001: yes', 'UC-004: no'], questions: [] });
  });

  it('asks DEV for its questions when none are known', async () => {
    const { ctx, log } = scripted({
      'DEV:planImplementation': [{ action: 'planImplementation', output: 'p', implementationPlan: 'p', questions: [] }],
    });
    const result = await new ClarificationLoopCollaboration().run(ctx);
    expect(log).toEqual(['turn DEV:planImplementation']);
    expect(result.output.clarifications).toEqual([]);
  });
});

describe('agent_collaboration node', () => {
  function setup() {
    const engine = { registerStrategy: jest.fn() };
    const { bus, persisted } = newBus();
    const repository = { updateRun: jest.fn().mockResolvedValue(undefined) };
    const strategy = new AgentCollaborationStrategy(engine as any, bus, repository as any);
    const executed: any[] = [];
    const outputs: Record<string, any> = {
      'QC:verify': { qc_passed: true, output: 'ok', qcReport: 'report' },
      'QA:review': { qa_approved: false, output: 'VERDICT: FAIL' },
    };
    const run: any = { id: 'run-1', projectId: 'p1', context: { goal: 'shop' } };
    const ctx: any = {
      logger: { log: jest.fn(), warn: jest.fn(), error: jest.fn() },
      getDefinition: jest.fn(),
      // Stands in for the engine + AgentTaskStrategy: records the step and merges the output into the variables
      executeNode: jest.fn(async (node: any, r: any) => {
        executed.push({ id: node.id, role: node.agentRole, taskType: node.taskType, vars: { ...r.context.variables } });
        const payload = outputs[`${node.agentRole}:${node.taskType}`];
        Object.assign(r.context.variables, payload);
        return { status: 'success', output: { action: { success: true, output: { action: node.taskType, ...payload } } } };
      }),
    };
    return { strategy, engine, repository, run, ctx, executed, persisted, bus };
  }

  it('registers with the engine and lists the three patterns', () => {
    const { strategy, engine } = setup();
    strategy.onModuleInit();
    expect(engine.registerStrategy).toHaveBeenCalledWith(strategy);
    expect(strategy.type).toBe('agent_collaboration');
    expect(strategy.registry.patterns().sort()).toEqual(['clarification_loop', 'pair_develop', 'review_chain']);
  });

  it('runs each turn as a workflow step, merges the result and returns the edge', async () => {
    const { strategy, repository, run, ctx, executed, persisted } = setup();

    const result = await strategy.execute({ id: 'review_chain', type: 'agent_collaboration', metadata: { pattern: 'review_chain' } }, run, ctx);

    expect(executed.map(e => [e.id, e.role, e.taskType])).toEqual([
      ['review_chain:1:qc-verify', 'QC', 'verify'],
      ['review_chain:2:qa-review', 'QA', 'review'],
    ]);
    expect(result).toEqual({
      status: 'success',
      output: expect.objectContaining({ pattern: 'review_chain', qa_approved: false, rejectedBy: ['QA'], edgeCondition: 'onFail' }),
    });
    expect(run.context.variables).toEqual(expect.objectContaining({ qcReport: 'report', review_approved: false, qa_approved: false }));
    expect(repository.updateRun).toHaveBeenCalledWith('run-1', { context: run.context });
    expect(persisted.map(p => `${p.metadata.performative} ${p.fromRole}->${p.toRole}`)).toEqual([
      'PROPOSE DEV->QC', 'ACCEPT QC->DEV', 'PROPOSE QC->QA', 'REJECT QA->QC',
    ]);
    expect(new Set(persisted.map(p => p.metadata.conversationId)).size).toBe(1);
    expect(persisted.every(p => p.metadata.protocol === 'review_chain')).toBe(true);
  });

  it('fails the node for an unknown pattern or a failing turn, and frees the conversation', async () => {
    const { strategy, run, ctx, bus } = setup();
    const end = jest.spyOn(bus, 'endConversation');

    expect(await strategy.execute({ id: 'x', type: 'agent_collaboration', metadata: { pattern: 'mob_programming' } }, run, ctx))
      .toEqual({ status: 'failure', error: expect.stringMatching(/Unknown collaboration pattern: mob_programming/) });

    ctx.executeNode.mockRejectedValueOnce(new Error('QC timed out'));
    expect(await strategy.execute({ id: 'y', type: 'agent_collaboration', metadata: { pattern: 'review_chain' } }, run, ctx))
      .toEqual({ status: 'failure', error: 'QC timed out' });
    expect(end).toHaveBeenCalledTimes(2);
  });

  it('refuses a duplicate pattern', () => {
    expect(() => new CollaborationRegistry([new ReviewChainCollaboration(), new ReviewChainCollaboration()])).toThrow(/already registered/);
  });
});

describe('Collaborative workflow variant', () => {
  const env = process.env.WORKFLOW_COLLABORATION;
  afterEach(() => {
    if (env === undefined) delete process.env.WORKFLOW_COLLABORATION;
    else process.env.WORKFLOW_COLLABORATION = env;
  });

  it('replaces develop/test/review with pair_develop and review_chain', () => {
    expect(() => WorkflowValidator.validate(PAIR_WORKFLOW_DEFINITION)).not.toThrow();
    const ids = PAIR_WORKFLOW_DEFINITION.nodes.map(n => n.id);
    expect(ids).not.toEqual(expect.arrayContaining(['develop']));
    expect(ids).not.toContain('test');
    expect(ids).not.toContain('qa_condition');
    expect(PAIR_WORKFLOW_DEFINITION.edges).toEqual(expect.arrayContaining([
      { from: 'breakdown', to: 'pair_develop' },
      { from: 'pair_develop', to: 'review_chain' },
      { from: 'review_chain', to: 'market', condition: 'onSuccess' },
      { from: 'review_chain', to: 'pair_develop', condition: 'onFail' },
    ]));
    for (const edge of PAIR_WORKFLOW_DEFINITION.edges) {
      expect(ids).toContain(edge.from);
      expect(ids).toContain(edge.to);
    }
  });

  it('is chosen for new projects with WORKFLOW_COLLABORATION=pair', () => {
    const builtIns = [DEFAULT_WORKFLOW_DEFINITION, PAIR_WORKFLOW_DEFINITION];
    const engine = { createWorkflow: jest.fn(), getDefinition: jest.fn((id: string) => builtIns.find(d => d.id === id)) };
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const service = new WorkflowDefinitionService(engine as any, { saveIfAbsent: jest.fn(), findAll: jest.fn() }, {} as any);

    expect(engine.createWorkflow).toHaveBeenCalledTimes(2);
    delete process.env.WORKFLOW_COLLABORATION;
    expect(service.getDefaultWorkflowDefinition()).toBe(DEFAULT_WORKFLOW_DEFINITION);
    process.env.WORKFLOW_COLLABORATION = 'pair';
    expect(service.getDefaultWorkflowDefinition()).toBe(PAIR_WORKFLOW_DEFINITION);
    expect(service.getWorkflowDefinition('pair-project-workflow')).toBe(PAIR_WORKFLOW_DEFINITION);
  });
});

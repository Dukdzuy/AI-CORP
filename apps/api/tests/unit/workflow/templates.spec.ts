import { BadRequestException, NotFoundException } from '@nestjs/common';
import { WorkflowDefinition } from '@ai-corp/shared-types';
import { TemplateParameterError } from '../../../src/domain/workflow/WorkflowTemplate';
import { WorkflowDefinitionRegistry } from '../../../src/modules/workflow/workflow-definition.registry';
import { WorkflowDefinitionService } from '../../../src/modules/workflow/workflow-definition.service';
import { SubWorkflowStrategy } from '../../../src/modules/workflow/strategies/sub-workflow.strategy';
import { BUILT_IN_TEMPLATES, WorkflowTemplateCatalog } from '../../../src/modules/workflow/templates/workflow-template.catalog';
import { OoadSoftwareProjectTemplate } from '../../../src/modules/workflow/templates/ooad-software-project.template';
import { RestApiBackendTemplate } from '../../../src/modules/workflow/templates/rest-api-backend.template';
import { createEngine, waitForStatus } from './engine-harness';

jest.mock('bullmq', () => ({
  Queue: jest.fn(() => ({ add: jest.fn(), close: jest.fn(), on: jest.fn() })),
  Worker: jest.fn(() => ({ on: jest.fn(), close: jest.fn() })),
}));

beforeAll(() => {
  process.env.REDIS_PORT = '1';
  SubWorkflowStrategy.retryDelayMs = 0;
});
afterEach(() => jest.restoreAllMocks());

const nodeIds = (def: WorkflowDefinition) => def.nodes.map(n => n.id);

describe('Workflow templates (Task 19)', () => {
  it.each(BUILT_IN_TEMPLATES().map(t => [t.id, t] as const))('%s instantiates with its defaults into valid definitions', (_id, template) => {
    const instance = template.instantiate({});
    const registry = new WorkflowDefinitionRegistry();
    instance.subWorkflows.forEach(sub => registry.register(sub));
    expect(() => registry.register(instance.definition)).not.toThrow();
    // Every sub_workflow node is pinned to a sub-workflow of the same instance
    for (const node of instance.definition.nodes.filter(n => n.type === 'sub_workflow')) {
      expect(instance.subWorkflows.map(s => `${s.id}@${s.version}`)).toContain(`${node.subWorkflowId}@${node.subWorkflowVersion}`);
    }
  });

  it('composes the full project from the analysis/design and build/verify sub-workflows', () => {
    const { definition, subWorkflows, parameters } = new OoadSoftwareProjectTemplate().instantiate({});
    expect(parameters).toEqual({ collaboration: 'sequential', minUseCases: 5, announcement: true, parallelMarketing: false, humanApproval: true });
    expect(nodeIds(definition)).toEqual(['start', 'analysis_design', 'breakdown', 'build', 'market', 'approval', 'end']);
    expect(definition.edges).toContainEqual({ from: 'approval', to: 'end', condition: 'onApprove' });
    expect(subWorkflows.map(s => s.id)).toEqual(['ooad-analysis-design', 'ooad-build-verify']);
    expect(definition.version).toMatch(/^1\.0\.0\+[0-9a-f]{8}$/);
  });

  it('switches nodes on and off from typed parameters', () => {
    const template = new OoadSoftwareProjectTemplate();
    const lean = template.instantiate({ announcement: false, humanApproval: 'false', minUseCases: '3' });
    expect(nodeIds(lean.definition)).toEqual(['start', 'analysis_design', 'breakdown', 'build', 'end']);
    const gate = lean.subWorkflows[0].nodes.find(n => n.id === 'ooad_gate')!;
    expect((gate.metadata as any).criteria.minUseCases).toBe(3);

    const pair = template.instantiate({ collaboration: 'pair' });
    expect(pair.subWorkflows[1].id).toBe('ooad-pair-build');
    expect(pair.subWorkflows[1].nodes.map(n => n.type)).toEqual(['agent_collaboration', 'agent_collaboration']);
  });

  it('runs Marketing in parallel with the QA review when asked', () => {
    const { definition, subWorkflows } = new OoadSoftwareProjectTemplate().instantiate({ parallelMarketing: true });
    expect(nodeIds(definition)).not.toContain('market');
    const parallel = subWorkflows[1].nodes.find(n => n.type === 'parallel')!;
    expect((parallel.metadata as any).branches).toEqual([{ nodeId: 'review' }, { nodeId: 'market' }]);
  });

  it('versions by content: same parameters give the same versions, others give new ones', () => {
    const template = new OoadSoftwareProjectTemplate();
    const a = template.instantiate({ minUseCases: 4 });
    const b = template.instantiate({ minUseCases: '4' });
    const c = template.instantiate({ minUseCases: 6 });
    expect(b.definition.version).toBe(a.definition.version);
    expect(c.definition.version).not.toBe(a.definition.version);
    // The build sub-workflow did not change, so both instances share it
    expect(c.subWorkflows[1].version).toBe(a.subWorkflows[1].version);
    expect(c.subWorkflows[0].version).not.toBe(a.subWorkflows[0].version);
  });

  it('hands the database choice to the Architect as a node constraint in the REST API template', () => {
    const { subWorkflows } = new RestApiBackendTemplate().instantiate({ database: 'MongoDB' });
    const design = subWorkflows[0].nodes.find(n => n.id === 'design')!;
    expect(String((design.metadata as any).constraints)).toContain('persisted in MongoDB');
  });

  it('validates parameters: unknown names, types, ranges and options', () => {
    const template = new OoadSoftwareProjectTemplate();
    const problems = (input: Record<string, unknown>) => {
      try {
        template.instantiate(input);
        return [];
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateParameterError);
        return (error as TemplateParameterError).problems;
      }
    };
    expect(problems({ colour: 'red' })).toEqual(["unknown parameter 'colour'"]);
    expect(problems({ minUseCases: 'many' })).toEqual(["'minUseCases' must be a number"]);
    expect(problems({ minUseCases: 50 })).toEqual(["'minUseCases' must be <= 20"]);
    expect(problems({ collaboration: 'mob' })).toEqual(["'collaboration' must be one of sequential, pair"]);
    expect(problems({ humanApproval: 'yes' })).toEqual(["'humanApproval' must be true or false"]);
  });
});

describe('WorkflowDefinitionService templates', () => {
  function service() {
    const { engine, repository, calls } = createEngine((role, input) => {
      if (role === 'QA') return { qa_approved: true };
      return { output: `${role}:${input.taskType}` };
    });
    const store = { saveIfAbsent: jest.fn().mockResolvedValue(undefined), findAll: jest.fn().mockResolvedValue([]) };
    const svc = new WorkflowDefinitionService(engine, store, new WorkflowTemplateCatalog(BUILT_IN_TEMPLATES()));
    return { svc, engine, repository, calls, store };
  }

  it('lists the template library', () => {
    expect(service().svc.listTemplates().map(t => t.id)).toEqual(['ooad-software-project', 'rest-api-backend', 'ooad-design-only']);
  });

  it('maps bad parameters to 400 and unknown templates to 404', () => {
    const { svc } = service();
    expect(() => svc.previewTemplate('ooad-software-project', { minUseCases: 0 })).toThrow(BadRequestException);
    expect(() => svc.previewTemplate('ml-pipeline', {})).toThrow(NotFoundException);
  });

  it('registers and stores the sub-workflows before the main definition', async () => {
    const { svc, engine, store } = service();
    const { definition } = await svc.instantiateTemplate('ooad-design-only', { humanApproval: false });

    expect(store.saveIfAbsent.mock.calls.map(([arg]) => arg.definition.id)).toEqual(['ooad-analysis-design', 'ooad-design-only']);
    expect(store.saveIfAbsent).toHaveBeenCalledWith(expect.objectContaining({ templateId: 'ooad-design-only', parameters: { minUseCases: 5, humanApproval: false } }));
    expect(engine.getDefinition('ooad-design-only', definition.version)).toBe(definition);
  });

  it('reloads stored definitions after a restart, sub-workflows first even when stored out of order', async () => {
    const first = service();
    await first.svc.instantiateTemplate('rest-api-backend', {});
    const stored = first.store.saveIfAbsent.mock.calls.map(([arg]) => ({ definitionId: arg.definition.id, version: arg.definition.version, definition: arg.definition })).reverse();

    const second = service();
    second.store.findAll.mockResolvedValue(stored);
    await second.svc.onModuleInit();
    expect(second.engine.getDefinition('rest-api-backend', stored[0].version)).toBeDefined();
    expect(second.engine.getDefinition('ooad-build-verify')).toBeDefined();
    // The built-in workflows are stored too
    expect(second.store.saveIfAbsent).toHaveBeenCalledWith({ definition: expect.objectContaining({ id: 'default-project-workflow' }) });
  });

  it('runs an instantiated template end to end through its sub-workflows', async () => {
    const { svc, engine, repository, calls } = service();
    const { definition } = await svc.instantiateTemplate('ooad-software-project', { humanApproval: false, parallelMarketing: true, minUseCases: 1 });
    // The gate reads project data through the quality gate strategy, which this harness doesn't wire: skip it
    engine.registerStrategy({ type: 'quality_gate', execute: async () => ({ status: 'success', output: { edgeCondition: 'onSuccess' } }) });

    const run = await engine.startWorkflow('p1', definition.id, { projectId: 'p1', variables: {} }, definition.version);
    const done = await waitForStatus(repository, run.id, ['completed', 'failed']);

    expect(done.status).toBe('completed');
    expect(calls.map(c => `${c.role}:${c.taskType}`)).toEqual(expect.arrayContaining([
      'CEO:planMilestones', 'BA:generateUseCases', 'ARCHITECT:designArchitecture', 'PM:breakdownTasks',
      'DEV:implement', 'QC:verify', 'QA:review', 'MARKETING:draftAnnouncement', 'CEO:complete_project',
    ]));
    const children = await repository.findChildRuns(run.id);
    expect(children.map(c => [c.workflowDefId, c.parentNodeId, c.status])).toEqual([
      ['ooad-analysis-design', 'analysis_design', 'completed'],
      ['ooad-build-verify', 'build', 'completed'],
    ]);
  });

  it('passes the template constraint to the Architect agent', async () => {
    const { svc, engine, repository, calls } = service();
    const { definition } = await svc.instantiateTemplate('rest-api-backend', { database: 'MongoDB' });
    engine.registerStrategy({ type: 'quality_gate', execute: async () => ({ status: 'success', output: { edgeCondition: 'onSuccess' } }) });

    const run = await engine.startWorkflow('p1', definition.id, { projectId: 'p1', variables: {} }, definition.version);
    expect((await waitForStatus(repository, run.id, ['completed', 'failed'])).status).toBe('completed');
    const architect = calls.find(c => c.role === 'ARCHITECT')!;
    expect(architect.input.constraints).toContain('persisted in MongoDB');
    expect(calls.find(c => c.role === 'BA')!.input.constraints).toBeUndefined();
  });
});

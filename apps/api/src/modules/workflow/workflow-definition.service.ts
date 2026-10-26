import { BadRequestException, Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InstantiatedWorkflow, WorkflowDefinition, WorkflowTemplateSummary } from '@ai-corp/shared-types';
import { TemplateParameterError } from '../../domain/workflow/WorkflowTemplate';
import { DEFAULT_WORKFLOW_DEFINITION, PAIR_WORKFLOW_DEFINITION } from './default-workflow';
import { WorkflowEngine } from './workflow.engine';
import { WorkflowDefinitionRegistry } from './workflow-definition.registry';
import { IWorkflowDefinitionRepository, WORKFLOW_DEFINITION_REPOSITORY } from './persistence/workflow-definition.repository';
import { WorkflowTemplateCatalog } from './templates/workflow-template.catalog';

/**
 * Application service for workflow definitions: the built-in workflows, versions stored in the
 * database (Task 17) and definitions instantiated from templates (Task 19).
 */
@Injectable()
export class WorkflowDefinitionService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowDefinitionService.name);
  private readonly definitions = [DEFAULT_WORKFLOW_DEFINITION, PAIR_WORKFLOW_DEFINITION];

  constructor(
    private readonly workflowEngine: WorkflowEngine,
    @Inject(WORKFLOW_DEFINITION_REPOSITORY) private readonly repository: IWorkflowDefinitionRepository,
    private readonly templates: WorkflowTemplateCatalog
  ) {
    this.registerDefaultDefinitions();
  }

  private registerDefaultDefinitions(): void {
    this.definitions.forEach(def => this.workflowEngine.createWorkflow(def));
    this.logger.log(`Registered workflow definitions; new projects use ${this.getDefaultWorkflowDefinition().id}`);
  }

  /**
   * Load stored versions (definitions instantiated from templates before a restart, so their runs
   * still find them) and store the built-in ones. The built-ins in code win over a stored row with
   * the same version but other content: that means the code was changed without a version bump.
   */
  async onModuleInit(): Promise<void> {
    try {
      let pending = await this.repository.findAll();
      // Sub-workflows must be registered before the definitions that use them; retry until no progress
      while (pending.length > 0) {
        const failed: typeof pending = [];
        let lastError = '';
        for (const record of pending) {
          try {
            this.workflowEngine.createWorkflow(record.definition);
          } catch (error) {
            lastError = (error as Error).message;
            failed.push(record);
          }
        }
        if (failed.length === pending.length) {
          failed.forEach(r => this.logger.warn(`Skipped stored workflow ${r.definitionId}@${r.version}: ${lastError}`));
          break;
        }
        pending = failed;
      }
      for (const def of this.definitions) {
        await this.repository.saveIfAbsent({ definition: def });
      }
    } catch (error) {
      this.logger.warn(`Could not sync workflow definitions with the database: ${(error as Error).message}`);
    }
  }

  /**
   * Workflow new projects start with. WORKFLOW_COLLABORATION=pair picks the collaborative
   * variant (pair_develop + review_chain, Task 15); anything else keeps the sequential one.
   */
  getDefaultWorkflowDefinition(): WorkflowDefinition {
    return (process.env.WORKFLOW_COLLABORATION || '').trim().toLowerCase() === 'pair'
      ? PAIR_WORKFLOW_DEFINITION
      : DEFAULT_WORKFLOW_DEFINITION;
  }

  getWorkflowDefinition(id: string, version?: string): WorkflowDefinition | undefined {
    return this.workflowEngine.getDefinition(id, version);
  }

  listDefinitions(): { id: string; name: string; latestVersion: string; versions: string[] }[] {
    return this.workflowEngine.listDefinitions().map(def => ({
      id: def.id,
      name: def.name,
      latestVersion: def.version,
      versions: this.workflowEngine.versionsOf(def.id).map(v => v.version),
    }));
  }

  listTemplates(): WorkflowTemplateSummary[] {
    return this.templates.list();
  }

  /**
   * Instantiate a template without registering anything, validating the result against a scratch
   * registry (same rules as the engine's) so the preview is exactly what would run.
   */
  previewTemplate(templateId: string, parameters: Record<string, unknown> = {}): InstantiatedWorkflow {
    const instance = this.instantiate(templateId, parameters);
    const scratch = new WorkflowDefinitionRegistry();
    try {
      [...instance.subWorkflows, instance.definition].forEach(def => scratch.register(def));
    } catch (error) {
      throw new BadRequestException(`Template ${templateId} produced an invalid workflow: ${(error as Error).message}`);
    }
    return instance;
  }

  /** Instantiate a template, register and store its definitions; returns the main definition to start */
  async instantiateTemplate(templateId: string, parameters: Record<string, unknown> = {}): Promise<{ definition: WorkflowDefinition; instance: InstantiatedWorkflow }> {
    const instance = this.previewTemplate(templateId, parameters);
    for (const sub of instance.subWorkflows) {
      this.workflowEngine.createWorkflow(sub);
      await this.repository.saveIfAbsent({ definition: sub, templateId, parameters: instance.parameters });
    }
    const definition = this.workflowEngine.createWorkflow(instance.definition);
    await this.repository.saveIfAbsent({ definition, templateId, parameters: instance.parameters });
    return { definition, instance };
  }

  private instantiate(templateId: string, parameters: Record<string, unknown>): InstantiatedWorkflow {
    const template = this.templates.get(templateId);
    try {
      return template.instantiate(parameters);
    } catch (error) {
      if (error instanceof TemplateParameterError) throw new BadRequestException(error.message);
      throw error;
    }
  }
}

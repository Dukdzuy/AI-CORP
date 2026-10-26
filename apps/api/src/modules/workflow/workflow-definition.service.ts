import { Injectable, Logger } from '@nestjs/common';
import { WorkflowDefinition } from '@ai-corp/shared-types';
import { DEFAULT_WORKFLOW_DEFINITION, PAIR_WORKFLOW_DEFINITION } from './default-workflow';
import { WorkflowEngine } from './workflow.engine';

@Injectable()
export class WorkflowDefinitionService {
  private readonly logger = new Logger(WorkflowDefinitionService.name);
  private readonly definitions = [DEFAULT_WORKFLOW_DEFINITION, PAIR_WORKFLOW_DEFINITION];

  constructor(private readonly workflowEngine: WorkflowEngine) {
    this.registerDefaultDefinitions();
  }

  private registerDefaultDefinitions(): void {
    this.definitions.forEach(def => this.workflowEngine.createWorkflow(def));
    this.logger.log(`Registered workflow definitions; new projects use ${this.getDefaultWorkflowDefinition().id}`);
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

  getWorkflowDefinition(id: string): WorkflowDefinition | undefined {
    return this.definitions.find(def => def.id === id);
  }
}

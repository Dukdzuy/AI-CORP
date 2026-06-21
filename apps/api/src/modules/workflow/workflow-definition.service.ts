import { Injectable, Logger } from '@nestjs/common';
import { WorkflowDefinition } from '@ai-corp/shared-types';
import { DEFAULT_WORKFLOW_DEFINITION } from './default-workflow';
import { WorkflowEngine } from './workflow.engine';

@Injectable()
export class WorkflowDefinitionService {
  private readonly logger = new Logger(WorkflowDefinitionService.name);

  constructor(private readonly workflowEngine: WorkflowEngine) {
    this.registerDefaultDefinitions();
  }

  private registerDefaultDefinitions(): void {
    this.workflowEngine.createWorkflow(DEFAULT_WORKFLOW_DEFINITION);
    this.logger.log('Registered default workflow definitions');
  }

  getDefaultWorkflowDefinition(): WorkflowDefinition {
    return DEFAULT_WORKFLOW_DEFINITION;
  }

  getWorkflowDefinition(id: string): WorkflowDefinition | undefined {
    if (id === DEFAULT_WORKFLOW_DEFINITION.id) {
      return DEFAULT_WORKFLOW_DEFINITION;
    }
    return undefined;
  }
}

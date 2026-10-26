import { WorkflowDefinition, WorkflowNode, WorkflowTemplateParameter } from '@ai-corp/shared-types';
import { TemplateParameterValues, WorkflowTemplate } from '../../../domain/workflow/WorkflowTemplate';
import {
  ANALYSIS_DESIGN_SUB_WORKFLOW_ID,
  BUILD_VERIFY_SUB_WORKFLOW_ID,
  analysisDesignSubWorkflow,
  buildVerifySubWorkflow,
  subWorkflowNode,
  topLevelNode,
} from './sub-workflows';
import { linearEdges } from './ooad-software-project.template';

/**
 * A backend-only project: no announcement, no approval pause. The persistence choice reaches the
 * Architect's design prompts as a node constraint, so the repository implementations are designed for it.
 */
export class RestApiBackendTemplate extends WorkflowTemplate {
  readonly id = 'rest-api-backend';
  readonly name = 'REST API backend';
  readonly description =
    'Backend service only: use cases, layered design for the chosen database, implementation, acceptance tests and QA review, then CEO close-out. Reuses the same sub-workflows as the full project.';
  readonly category = 'software_development' as const;
  readonly version = '1.0.0';
  readonly parameters: WorkflowTemplateParameter[] = [
    {
      name: 'database',
      type: 'enum',
      label: 'Database',
      description: 'Persistence the repository implementations are designed for.',
      required: true,
      defaultValue: 'PostgreSQL',
      options: ['PostgreSQL', 'MongoDB', 'In-memory'],
    },
    {
      name: 'minUseCases',
      type: 'number',
      label: 'Minimum use cases',
      description: 'The OOAD gate fails until BA has written at least this many use cases.',
      required: false,
      defaultValue: 3,
      min: 1,
      max: 20,
    },
  ];

  protected build(params: TemplateParameterValues) {
    const analysisDesign = analysisDesignSubWorkflow({
      minUseCases: Number(params.minUseCases),
      designConstraints: `The system is a REST API backend persisted in ${params.database}: design the repository implementations in the infrastructure layer for ${params.database}.`,
    });
    const build = buildVerifySubWorkflow({ parallelMarketing: false });

    const chain: WorkflowNode[] = [
      topLevelNode('start'),
      subWorkflowNode('analysis_design', ANALYSIS_DESIGN_SUB_WORKFLOW_ID, `Use cases and a ${params.database}-backed layered design`),
      topLevelNode('breakdown'),
      subWorkflowNode('build', BUILD_VERIFY_SUB_WORKFLOW_ID, 'Implementation, acceptance tests and QA review'),
      topLevelNode('end'),
    ];
    const definition: WorkflowDefinition = {
      id: this.id,
      name: this.name,
      version: this.version,
      startNode: 'start',
      endNode: 'end',
      nodes: chain,
      edges: linearEdges(chain),
    };
    return { definition, subWorkflows: [analysisDesign, build] };
  }
}

import { WorkflowDefinition, WorkflowNode, WorkflowTemplateParameter } from '@ai-corp/shared-types';
import { TemplateParameterValues, WorkflowTemplate } from '../../../domain/workflow/WorkflowTemplate';
import { ANALYSIS_DESIGN_SUB_WORKFLOW_ID, analysisDesignSubWorkflow, subWorkflowNode, topLevelNode } from './sub-workflows';
import { linearEdges } from './ooad-software-project.template';

/** Analysis and design only: the OOAD documents and code skeleton, reviewed by a person */
export class OoadDesignOnlyTemplate extends WorkflowTemplate {
  readonly id = 'ooad-design-only';
  readonly name = 'OOAD analysis & design';
  readonly description =
    'Produces the OOAD documents (use cases, domain model, class and sequence diagrams, patterns) and the code skeleton, checked by the OOAD gate. No implementation.';
  readonly category = 'design' as const;
  readonly version = '1.0.0';
  readonly parameters: WorkflowTemplateParameter[] = [
    {
      name: 'minUseCases',
      type: 'number',
      label: 'Minimum use cases',
      description: 'The OOAD gate fails until BA has written at least this many use cases.',
      required: false,
      defaultValue: 5,
      min: 1,
      max: 20,
    },
    {
      name: 'humanApproval',
      type: 'boolean',
      label: 'Human approval',
      description: 'Pause for your review of the design before the CEO closes the project.',
      required: false,
      defaultValue: true,
    },
  ];

  protected build(params: TemplateParameterValues) {
    const chain: WorkflowNode[] = [
      topLevelNode('start'),
      subWorkflowNode('analysis_design', ANALYSIS_DESIGN_SUB_WORKFLOW_ID, 'BA use cases, Architect design and the OOAD gate'),
    ];
    if (params.humanApproval === true) chain.push(topLevelNode('approval'));
    chain.push(topLevelNode('end'));

    const definition: WorkflowDefinition = {
      id: this.id,
      name: this.name,
      version: this.version,
      startNode: 'start',
      endNode: 'end',
      nodes: chain,
      edges: linearEdges(chain),
    };
    return { definition, subWorkflows: [analysisDesignSubWorkflow({ minUseCases: Number(params.minUseCases) })] };
  }
}

import { WorkflowDefinition, WorkflowEdge, WorkflowNode, WorkflowTemplateParameter } from '@ai-corp/shared-types';
import { TemplateParameterValues, WorkflowTemplate } from '../../../domain/workflow/WorkflowTemplate';
import {
  ANALYSIS_DESIGN_SUB_WORKFLOW_ID,
  BUILD_VERIFY_SUB_WORKFLOW_ID,
  PAIR_BUILD_SUB_WORKFLOW_ID,
  analysisDesignSubWorkflow,
  buildVerifySubWorkflow,
  pairBuildSubWorkflow,
  subWorkflowNode,
  topLevelNode,
} from './sub-workflows';

/**
 * The full OOAD project as a composition of sub-workflows:
 * CEO → [Analysis & Design] → PM → [Build & Verify | Pair Build] → Marketing? → approval? → CEO
 */
export class OoadSoftwareProjectTemplate extends WorkflowTemplate {
  readonly id = 'ooad-software-project';
  readonly name = 'OOAD software project';
  readonly description =
    'Full lifecycle: milestones, use cases, design and OOAD gate, one task per use case, implementation, executed acceptance tests and QA review. Analysis/design and build/verify run as reusable sub-workflows.';
  readonly category = 'software_development' as const;
  readonly version = '1.0.0';
  readonly parameters: WorkflowTemplateParameter[] = [
    {
      name: 'collaboration',
      type: 'enum',
      label: 'Build style',
      description: 'sequential: DEV → QC → QA. pair: DEV pairs with the Architect, then QC and QA review in a chain.',
      required: false,
      defaultValue: 'sequential',
      options: ['sequential', 'pair'],
    },
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
      name: 'announcement',
      type: 'boolean',
      label: 'Marketing announcement',
      description: 'Marketing drafts an announcement of the finished project.',
      required: false,
      defaultValue: true,
    },
    {
      name: 'parallelMarketing',
      type: 'boolean',
      label: 'Announce while QA reviews',
      description: 'Run Marketing in parallel with the QA review instead of after it (sequential build style only).',
      required: false,
      defaultValue: false,
    },
    {
      name: 'humanApproval',
      type: 'boolean',
      label: 'Human approval',
      description: 'Pause for your approval before the CEO closes the project.',
      required: false,
      defaultValue: true,
    },
  ];

  protected build(params: TemplateParameterValues) {
    const pair = params.collaboration === 'pair';
    const announce = params.announcement === true;
    const marketingInBuild = announce && !pair && params.parallelMarketing === true;

    const analysisDesign = analysisDesignSubWorkflow({ minUseCases: Number(params.minUseCases) });
    const build = pair ? pairBuildSubWorkflow() : buildVerifySubWorkflow({ parallelMarketing: marketingInBuild });

    const chain: WorkflowNode[] = [
      topLevelNode('start'),
      subWorkflowNode('analysis_design', ANALYSIS_DESIGN_SUB_WORKFLOW_ID, 'BA use cases, Architect design and the OOAD gate'),
      topLevelNode('breakdown'),
      subWorkflowNode('build', pair ? PAIR_BUILD_SUB_WORKFLOW_ID : BUILD_VERIFY_SUB_WORKFLOW_ID,
        pair ? 'Pair development and review chain' : 'Implementation, acceptance tests and QA review'),
    ];
    if (announce && !marketingInBuild) chain.push(topLevelNode('market'));
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
    return { definition, subWorkflows: [analysisDesign, build] };
  }
}

/** Edges for a straight chain; the edge out of a human approval node needs the onApprove condition */
export function linearEdges(chain: WorkflowNode[]): WorkflowEdge[] {
  return chain.slice(1).map((node, i) => {
    const from = chain[i];
    return from.type === 'human_approval'
      ? { from: from.id, to: node.id, condition: 'onApprove' }
      : { from: from.id, to: node.id };
  });
}

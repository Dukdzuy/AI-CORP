import { WorkflowDefinition, WorkflowNode } from '@ai-corp/shared-types';
import { DEFAULT_WORKFLOW_DEFINITION, PAIR_WORKFLOW_DEFINITION } from '../default-workflow';

/**
 * Reusable sub-workflows (Task 16) that the templates compose (Task 19).
 * Nodes are copied from the default workflows so prompts and limits stay in one place.
 * A sub-workflow ends after its end node when no edge leaves it for the node's outcome
 * (WorkflowGraph), so a gate or condition can be the end node and still loop back on failure.
 */

export const ANALYSIS_DESIGN_SUB_WORKFLOW_ID = 'ooad-analysis-design';
export const BUILD_VERIFY_SUB_WORKFLOW_ID = 'ooad-build-verify';
export const PAIR_BUILD_SUB_WORKFLOW_ID = 'ooad-pair-build';

function nodeOf(definition: WorkflowDefinition, id: string, overrides: Partial<WorkflowNode> = {}): WorkflowNode {
  const node = definition.nodes.find(n => n.id === id);
  if (!node) throw new Error(`Node ${id} not found in ${definition.id}`);
  return { ...node, metadata: { ...(node.metadata || {}) }, ...overrides };
}

/** BA use cases → Architect design → OOAD gate (failed gate loops back to the Architect) */
export function analysisDesignSubWorkflow(options: { minUseCases: number; designConstraints?: string }): WorkflowDefinition {
  const design = nodeOf(DEFAULT_WORKFLOW_DEFINITION, 'design');
  if (options.designConstraints) {
    // AgentTaskStrategy passes node constraints to the agent; the Architect adds them to its design prompts
    design.metadata = { ...design.metadata, constraints: options.designConstraints };
  }
  const gate = nodeOf(DEFAULT_WORKFLOW_DEFINITION, 'ooad_gate');
  gate.metadata = {
    ...gate.metadata,
    criteria: { ...((gate.metadata?.criteria as Record<string, unknown>) || {}), minUseCases: options.minUseCases },
  };

  return {
    id: ANALYSIS_DESIGN_SUB_WORKFLOW_ID,
    name: 'OOAD Analysis & Design',
    version: '1.0.0',
    startNode: 'analyze',
    endNode: 'ooad_gate',
    nodes: [nodeOf(DEFAULT_WORKFLOW_DEFINITION, 'analyze'), design, gate],
    edges: [
      { from: 'analyze', to: 'design' },
      { from: 'design', to: 'ooad_gate' },
      { from: 'ooad_gate', to: 'design', condition: 'onFail' },
    ],
  };
}

/**
 * DEV → QC → QA → condition (rejected → back to DEV).
 * With parallelMarketing, Marketing drafts the announcement while QA reviews (Task 18): both only
 * need QC's report, so they run as two branches of one parallel node.
 */
export function buildVerifySubWorkflow(options: { parallelMarketing: boolean }): WorkflowDefinition {
  const develop = nodeOf(DEFAULT_WORKFLOW_DEFINITION, 'develop');
  const test = nodeOf(DEFAULT_WORKFLOW_DEFINITION, 'test');
  const review = nodeOf(DEFAULT_WORKFLOW_DEFINITION, 'review');
  const condition = nodeOf(DEFAULT_WORKFLOW_DEFINITION, 'qa_condition');

  if (!options.parallelMarketing) {
    return {
      id: BUILD_VERIFY_SUB_WORKFLOW_ID,
      name: 'Build & Verify',
      version: '1.0.0',
      startNode: 'develop',
      endNode: 'qa_condition',
      nodes: [develop, test, review, condition],
      edges: [
        { from: 'develop', to: 'test' },
        { from: 'test', to: 'review' },
        { from: 'review', to: 'qa_condition' },
        { from: 'qa_condition', to: 'develop', condition: 'onFail' },
      ],
    };
  }

  return {
    id: BUILD_VERIFY_SUB_WORKFLOW_ID,
    name: 'Build & Verify (QA review and announcement in parallel)',
    version: '1.0.0',
    startNode: 'develop',
    endNode: 'qa_condition',
    nodes: [
      develop,
      test,
      {
        id: 'review_and_announce',
        type: 'parallel',
        timeout: 600000,
        maxRetries: 0,
        metadata: {
          description: 'QA reviews design conformance while Marketing drafts the announcement',
          branches: [{ nodeId: 'review' }, { nodeId: 'market' }],
          concurrencyLimit: 2,
        },
      },
      review,
      nodeOf(DEFAULT_WORKFLOW_DEFINITION, 'market'),
      condition,
    ],
    edges: [
      { from: 'develop', to: 'test' },
      { from: 'test', to: 'review_and_announce' },
      { from: 'review_and_announce', to: 'qa_condition' },
      { from: 'qa_condition', to: 'develop', condition: 'onFail' },
    ],
  };
}

/** pair_develop (DEV + Architect navigator) → review_chain (QC → QA); rejected → back to the pair */
export function pairBuildSubWorkflow(): WorkflowDefinition {
  return {
    id: PAIR_BUILD_SUB_WORKFLOW_ID,
    name: 'Pair Build & Review',
    version: '1.0.0',
    startNode: 'pair_develop',
    endNode: 'review_chain',
    nodes: [nodeOf(PAIR_WORKFLOW_DEFINITION, 'pair_develop'), nodeOf(PAIR_WORKFLOW_DEFINITION, 'review_chain')],
    edges: [
      { from: 'pair_develop', to: 'review_chain' },
      { from: 'review_chain', to: 'pair_develop', condition: 'onFail' },
    ],
  };
}

/** A sub_workflow node; generous timeout because the whole child runs inside it */
export function subWorkflowNode(id: string, subWorkflowId: string, description: string, timeout = 3600000): WorkflowNode {
  return { id, type: 'sub_workflow', subWorkflowId, maxRetries: 0, timeout, metadata: { description } };
}

export function topLevelNode(id: string): WorkflowNode {
  return nodeOf(DEFAULT_WORKFLOW_DEFINITION, id);
}

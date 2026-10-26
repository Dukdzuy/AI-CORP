import { WorkflowDefinition, WorkflowNode } from '@ai-corp/shared-types';

/** Where a run goes after a node finished with a given edge condition */
export type Transition =
  | { kind: 'next'; nodeId: string }
  | { kind: 'complete' }
  | { kind: 'dead_end'; reason: string };

/**
 * Read-only view of a workflow definition as a directed graph.
 * One place that decides "which node comes next", shared by the engine (top-level runs)
 * and the sub-workflow runner (child runs), so both follow the same rules.
 *
 * Rules: a single unconditional edge is always taken; otherwise the edge whose condition equals
 * the node's edge condition is taken; when no edge matches, the run completes if the node is the
 * definition's end node and dead-ends otherwise.
 */
export class WorkflowGraph {
  private readonly nodesById: Map<string, WorkflowNode>;

  constructor(readonly definition: WorkflowDefinition) {
    this.nodesById = new Map(definition.nodes.map(n => [n.id, n]));
  }

  get startNodeId(): string {
    return this.definition.startNode;
  }

  node(nodeId: string): WorkflowNode | undefined {
    return this.nodesById.get(nodeId);
  }

  requireNode(nodeId: string): WorkflowNode {
    const node = this.node(nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found in workflow ${this.definition.id}`);
    return node;
  }

  isEnd(nodeId: string): boolean {
    return nodeId === this.definition.endNode;
  }

  next(fromNodeId: string, edgeCondition?: string): Transition {
    const outgoing = this.definition.edges.filter(e => e.from === fromNodeId);
    const edge = outgoing.length === 1 && !outgoing[0].condition
      ? outgoing[0]
      : outgoing.find(e => e.condition === edgeCondition);

    if (edge) return { kind: 'next', nodeId: edge.to };
    if (this.isEnd(fromNodeId)) return { kind: 'complete' };
    return {
      kind: 'dead_end',
      reason: `No valid next node from '${fromNodeId}' for condition '${edgeCondition}'`,
    };
  }

  /**
   * Where a run goes after a node failed: only an explicit 'onFail' edge is followed, so a
   * failed node never silently continues down its success path.
   */
  nextAfterFailure(fromNodeId: string, error?: string): Transition {
    const edge = this.definition.edges.find(e => e.from === fromNodeId && e.condition === 'onFail');
    if (edge) return { kind: 'next', nodeId: edge.to };
    return { kind: 'dead_end', reason: error || `Node '${fromNodeId}' failed and has no onFail edge` };
  }

  /** Ids of the sub-workflows this definition's sub_workflow nodes run */
  subWorkflowReferences(): { nodeId: string; subWorkflowId: string; subWorkflowVersion?: string }[] {
    return this.definition.nodes
      .filter(n => n.type === 'sub_workflow')
      .map(n => ({ nodeId: n.id, subWorkflowId: n.subWorkflowId || '', subWorkflowVersion: n.subWorkflowVersion }));
  }
}

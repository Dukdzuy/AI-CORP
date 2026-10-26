import { ParallelBranch, WorkflowDefinition, WorkflowNode } from '@ai-corp/shared-types';
import { DependencyResolver } from '../../domain/workflow/DependencyResolver';
import { SemanticVersion } from '../../domain/workflow/SemanticVersion';

/** Looks up already registered definitions, so references to sub-workflows can be checked */
export interface DefinitionLookup {
  get(id: string, version?: string): WorkflowDefinition | undefined;
}

/** Node types a sub-workflow may not contain: they pause the run, and a sub-workflow runs inline */
const PAUSING_NODE_TYPES = new Set(['human_approval']);

export class WorkflowValidator {
  /**
   * Validates a workflow definition ensuring it has a start node, end node, and no cyclic dependencies (DAG validation).
   * With a lookup, also checks sub_workflow references (Task 16) and parallel branches (Task 18).
   * @param def Workflow Definition to validate
   * @throws Error if validation fails
   */
  static validate(def: WorkflowDefinition, lookup?: DefinitionLookup): void {
    if (!def.startNode) {
      throw new Error(`Workflow definition ${def.id} is missing a startNode.`);
    }

    if (!def.endNode) {
      throw new Error(`Workflow definition ${def.id} is missing an endNode.`);
    }

    if (def.version !== undefined && !SemanticVersion.isValid(def.version)) {
      throw new Error(`Workflow definition ${def.id} has an invalid version '${def.version}' (expected MAJOR.MINOR.PATCH[+build]).`);
    }

    const nodeIds = new Set(def.nodes.map((n: any) => n.id));
    if (!nodeIds.has(def.startNode)) {
      throw new Error(`Start node '${def.startNode}' does not exist in nodes array.`);
    }

    if (!nodeIds.has(def.endNode)) {
      throw new Error(`End node '${def.endNode}' does not exist in nodes array.`);
    }

    // Check for cycles using DFS
    this.detectCycles(def);

    for (const node of def.nodes) {
      if (node.type === 'parallel') this.validateParallel(def, node);
      if (node.type === 'sub_workflow') this.validateSubWorkflow(def, node, lookup);
    }
  }

  /**
   * Branches of a parallel node: the new `branches` form (with dependsOn) or the legacy `parallelNodes` list
   */
  static parallelBranches(node: WorkflowNode): ParallelBranch[] {
    const metadata = (node.metadata || {}) as Record<string, unknown>;
    if (Array.isArray(metadata.branches)) {
      return (metadata.branches as ParallelBranch[]).map(b => ({ nodeId: b.nodeId, dependsOn: b.dependsOn || [] }));
    }
    if (Array.isArray(metadata.parallelNodes)) {
      return (metadata.parallelNodes as string[]).map(nodeId => ({ nodeId, dependsOn: [] }));
    }
    return [];
  }

  private static validateParallel(def: WorkflowDefinition, node: WorkflowNode): void {
    const branches = this.parallelBranches(node);
    if (branches.length === 0) {
      throw new Error(`Parallel node ${node.id} has no branches (metadata.branches or metadata.parallelNodes).`);
    }
    for (const branch of branches) {
      const branchNode = def.nodes.find(n => n.id === branch.nodeId);
      if (!branchNode) throw new Error(`Parallel node ${node.id} references unknown node ${branch.nodeId}.`);
      if (branchNode.id === node.id) throw new Error(`Parallel node ${node.id} lists itself as a branch.`);
      if (PAUSING_NODE_TYPES.has(branchNode.type)) {
        throw new Error(`Parallel node ${node.id}: branch ${branch.nodeId} is a ${branchNode.type} node, which cannot run in parallel.`);
      }
    }
    const limit = (node.metadata as any)?.concurrencyLimit;
    if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
      throw new Error(`Parallel node ${node.id}: concurrencyLimit must be a positive integer.`);
    }
    // Throws on unknown dependencies and cycles
    new DependencyResolver(branches).layers();
  }

  private static validateSubWorkflow(def: WorkflowDefinition, node: WorkflowNode, lookup?: DefinitionLookup): void {
    if (!node.subWorkflowId) {
      throw new Error(`Sub-workflow node ${node.id} is missing subWorkflowId.`);
    }
    if (node.subWorkflowId === def.id) {
      throw new Error(`Sub-workflow node ${node.id} makes workflow ${def.id} call itself (recursive sub-workflows are not allowed).`);
    }
    if (!lookup) return;

    const sub = lookup.get(node.subWorkflowId, node.subWorkflowVersion);
    if (!sub) {
      const version = node.subWorkflowVersion ? `@${node.subWorkflowVersion}` : '';
      throw new Error(`Sub-workflow node ${node.id} references unknown workflow ${node.subWorkflowId}${version}; register it first.`);
    }
    const pausing = sub.nodes.find(n => PAUSING_NODE_TYPES.has(n.type));
    if (pausing) {
      throw new Error(`Workflow ${sub.id} cannot be used as a sub-workflow: node ${pausing.id} is a ${pausing.type} node.`);
    }
  }

  private static detectCycles(def: WorkflowDefinition): void {
    // Build adjacency list: unconditional edges only
    // Conditional edges (with condition property) are allowed to form loops
    // because they represent retry/branch logic, not strict DAG paths
    const adjList = new Map<string, string[]>();
    for (const node of def.nodes) {
      adjList.set(node.id, []);
    }

    for (const edge of def.edges) {
      if (!adjList.has(edge.from)) {
         throw new Error(`Edge references unknown from-node: ${edge.from}`);
      }
      if (!adjList.has(edge.to)) {
         throw new Error(`Edge references unknown to-node: ${edge.to}`);
      }
      // Only check unconditional edges for cycles
      // Conditional edges (onFail, onSuccess, etc.) are allowed to create loops
      // The executor tracks visited nodes to prevent infinite loops
      if (!edge.condition) {
        adjList.get(edge.from)!.push(edge.to);
      }
    }

    const visited = new Set<string>();
    const recursionStack = new Set<string>();

    const dfs = (nodeId: string): boolean => {
      if (recursionStack.has(nodeId)) return true; // Cycle detected
      if (visited.has(nodeId)) return false;

      visited.add(nodeId);
      recursionStack.add(nodeId);

      const neighbors = adjList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (dfs(neighbor)) return true;
      }

      recursionStack.delete(nodeId);
      return false;
    };

    for (const node of def.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) {
          throw new Error('Workflow definition is invalid: Contains a cycle in unconditional edges.');
        }
      }
    }
  }
}

import { WorkflowDefinition } from '@ai-corp/shared-types';

export class WorkflowValidator {
  /**
   * Validates a workflow definition ensuring it has a start node, end node, and no cyclic dependencies (DAG validation).
   * @param def Workflow Definition to validate
   * @throws Error if validation fails
   */
  static validate(def: WorkflowDefinition): void {
    if (!def.startNode) {
      throw new Error(`Workflow definition ${def.id} is missing a startNode.`);
    }

    if (!def.endNode) {
      throw new Error(`Workflow definition ${def.id} is missing an endNode.`);
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

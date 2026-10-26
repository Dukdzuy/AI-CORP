import { ParallelBranch } from '@ai-corp/shared-types';

export class CyclicDependencyError extends Error {
  constructor(readonly nodeIds: string[]) {
    super(`Parallel branches have a cyclic dependency: ${nodeIds.join(', ')}`);
    this.name = 'CyclicDependencyError';
  }
}

/**
 * Orders the branches of a parallel node by their dependencies (Task 18).
 * Kahn's algorithm: layer 0 holds the branches with no dependency, layer n the branches whose
 * dependencies are all in earlier layers. Branches left over form a cycle.
 */
export class DependencyResolver {
  constructor(private readonly branches: ParallelBranch[]) {
    const ids = new Set<string>();
    for (const branch of branches) {
      if (ids.has(branch.nodeId)) throw new Error(`Parallel branch ${branch.nodeId} is listed twice`);
      ids.add(branch.nodeId);
    }
    for (const branch of branches) {
      for (const dep of branch.dependsOn || []) {
        if (!ids.has(dep)) throw new Error(`Parallel branch ${branch.nodeId} depends on unknown branch ${dep}`);
        if (dep === branch.nodeId) throw new CyclicDependencyError([branch.nodeId]);
      }
    }
  }

  /** Branch ids grouped in layers; every branch only depends on branches of earlier layers */
  layers(): string[][] {
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, string[]>();
    for (const branch of this.branches) {
      inDegree.set(branch.nodeId, (branch.dependsOn || []).length);
      for (const dep of branch.dependsOn || []) {
        dependents.set(dep, [...(dependents.get(dep) || []), branch.nodeId]);
      }
    }

    const layers: string[][] = [];
    let current = this.branches.filter(b => inDegree.get(b.nodeId) === 0).map(b => b.nodeId);
    let placed = 0;
    while (current.length > 0) {
      layers.push(current);
      placed += current.length;
      const next: string[] = [];
      for (const nodeId of current) {
        for (const dependent of dependents.get(nodeId) || []) {
          const remaining = inDegree.get(dependent)! - 1;
          inDegree.set(dependent, remaining);
          if (remaining === 0) next.push(dependent);
        }
      }
      current = next;
    }

    if (placed < this.branches.length) {
      throw new CyclicDependencyError(
        this.branches.filter(b => (inDegree.get(b.nodeId) || 0) > 0).map(b => b.nodeId)
      );
    }
    return layers;
  }

  /** Layer index of each branch */
  layerOf(): Map<string, number> {
    const result = new Map<string, number>();
    this.layers().forEach((layer, index) => layer.forEach(id => result.set(id, index)));
    return result;
  }

  dependenciesOf(nodeId: string): string[] {
    return this.branches.find(b => b.nodeId === nodeId)?.dependsOn || [];
  }

  /** Branches whose dependencies are all in `done` and that are not started yet */
  ready(done: Set<string>, started: Set<string>): string[] {
    return this.branches
      .filter(b => !started.has(b.nodeId) && (b.dependsOn || []).every(dep => done.has(dep)))
      .map(b => b.nodeId);
  }
}

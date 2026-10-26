import { WorkflowNode, NodeResult, WorkflowStateChangedEvent, ParallelBranchResult } from '@ai-corp/shared-types';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { WorkflowRunRecord } from '../persistence/workflow-engine.repository';
import { NodeExecutionStrategy, NodeExecutionContext } from './node-execution-strategy';
import { DependencyResolver } from '../../../domain/workflow/DependencyResolver';
import { WorkflowValidator } from '../workflow-validator';

/**
 * Execute parallel nodes concurrently
 * Implements Requirement 2: Parallel node execution in workflow
 * Implements Requirement 9: WebSocket events for parallel execution
 * Implements Requirement 26: Performance optimization with parallel execution
 *
 * Task 18: branches may depend on other branches (metadata.branches[].dependsOn) and the number of
 * branches running at once can be capped (metadata.concurrencyLimit). Scheduling is list scheduling
 * over the dependency graph: a branch starts as soon as all its dependencies succeeded and a slot is
 * free, instead of waiting for its whole topological layer. Branches whose dependency failed are
 * skipped. The legacy metadata.parallelNodes list still works (no dependencies, no limit).
 */
export class ParallelStrategy implements NodeExecutionStrategy {
  readonly type = 'parallel' as const;

  constructor(private readonly websocketGateway: AppWebSocketGateway) {}

  async execute(node: WorkflowNode, run: WorkflowRunRecord, ctx: NodeExecutionContext): Promise<NodeResult> {
    ctx.logger.log(`Executing parallel node ${node.id}`);

    const branches = WorkflowValidator.parallelBranches(node);
    if (branches.length === 0) {
      throw new Error(`Parallel node ${node.id} missing parallelNodes in metadata`);
    }

    const def = ctx.definitionOf(run);
    if (!def) throw new Error(`Workflow definition ${run.workflowDefId} not found`);

    const nodesById = new Map<string, WorkflowNode>();
    for (const branch of branches) {
      const branchNode = def.nodes.find(n => n.id === branch.nodeId);
      if (!branchNode) throw new Error(`No valid parallel nodes found for node ${node.id}: ${branch.nodeId} is unknown`);
      nodesById.set(branch.nodeId, branchNode);
    }

    const resolver = new DependencyResolver(branches);
    const layerOf = resolver.layerOf();
    const limit = Math.max(1, Number((node.metadata as any)?.concurrencyLimit) || branches.length);

    ctx.logger.log(
      `Executing ${branches.length} branches in ${resolver.layers().length} layer(s), at most ${limit} at once: ${branches.map(b => b.nodeId).join(', ')}`
    );
    this.emit(run, node.id, 'running', 'parallel_execution');

    const results = new Map<string, ParallelBranchResult>();
    const succeeded = new Set<string>();
    const started = new Set<string>();
    const running = new Map<string, Promise<void>>();
    const errors: string[] = [];

    const runBranch = async (nodeId: string): Promise<void> => {
      const startedAt = new Date();
      ctx.logger.log(`Starting parallel execution of node ${nodeId}`);
      let status: 'success' | 'failure' = 'failure';
      let error: string | undefined;
      try {
        const result = await ctx.executeNode(nodesById.get(nodeId)!, run);
        status = result.status === 'success' ? 'success' : 'failure';
        error = result.error;
      } catch (e) {
        error = (e as Error).message || 'Unknown error';
      }
      const finishedAt = new Date();
      if (status === 'success') succeeded.add(nodeId);
      else errors.push(error || 'Unknown error');
      results.set(nodeId, {
        nodeId,
        status,
        layer: layerOf.get(nodeId) ?? 0,
        startedAt: startedAt.toISOString(),
        finishedAt: finishedAt.toISOString(),
        durationMs: finishedAt.getTime() - startedAt.getTime(),
        error,
      });
    };

    while (results.size < branches.length) {
      // A branch whose dependency did not succeed can never run
      for (const branch of branches) {
        if (started.has(branch.nodeId)) continue;
        const blockedBy = (branch.dependsOn || []).find(dep => results.has(dep) && !succeeded.has(dep));
        if (blockedBy) {
          started.add(branch.nodeId);
          results.set(branch.nodeId, {
            nodeId: branch.nodeId,
            status: 'skipped',
            layer: layerOf.get(branch.nodeId) ?? 0,
            error: `Skipped: dependency ${blockedBy} did not succeed`,
          });
        }
      }

      for (const nodeId of resolver.ready(succeeded, started)) {
        if (running.size >= limit) break;
        started.add(nodeId);
        running.set(nodeId, runBranch(nodeId).finally(() => running.delete(nodeId)));
      }

      if (running.size === 0) {
        if (results.size < branches.length) {
          throw new Error(`Parallel node ${node.id} could not schedule the remaining branches`);
        }
        break;
      }
      await Promise.race(running.values());
    }

    const ordered = branches.map(b => results.get(b.nodeId)!);
    const successCount = ordered.filter(r => r.status === 'success').length;
    const failureCount = ordered.filter(r => r.status === 'failure').length;
    const skippedCount = ordered.filter(r => r.status === 'skipped').length;
    const allSucceeded = successCount === branches.length;

    ctx.logger.log(
      `Parallel execution complete: ${successCount}/${branches.length} succeeded, ${failureCount} failed, ${skippedCount} skipped`
    );
    this.emit(run, node.id, 'parallel_execution', allSucceeded ? 'parallel_success' : 'parallel_partial_failure');

    return {
      status: allSucceeded ? 'success' : 'failure',
      output: {
        results: ordered,
        layers: resolver.layers(),
        concurrencyLimit: limit,
        allSucceeded,
        successCount,
        failureCount,
        skippedCount,
        totalCount: branches.length,
      },
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  }

  private emit(run: WorkflowRunRecord, nodeId: string, previousState: string, currentState: string): void {
    this.websocketGateway.sendToProject(run.projectId, {
      type: 'workflow:state_changed',
      data: {
        workflowRunId: run.id,
        projectId: run.projectId,
        previousState,
        currentState,
        currentNodeId: nodeId,
        timestamp: new Date()
      } as WorkflowStateChangedEvent,
      timestamp: new Date()
    });
  }
}

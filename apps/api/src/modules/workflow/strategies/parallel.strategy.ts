import { WorkflowNode, NodeResult, WorkflowStateChangedEvent } from '@ai-corp/shared-types';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { WorkflowRunRecord } from '../persistence/workflow-engine.repository';
import { NodeExecutionStrategy, NodeExecutionContext } from './node-execution-strategy';

/**
 * Execute parallel nodes concurrently
 * Implements Requirement 2: Parallel node execution in workflow
 * Implements Requirement 9: WebSocket events for parallel execution
 * Implements Requirement 26: Performance optimization with parallel execution
 */
export class ParallelStrategy implements NodeExecutionStrategy {
  readonly type = 'parallel' as const;

  constructor(private readonly websocketGateway: AppWebSocketGateway) {}

  async execute(node: WorkflowNode, run: WorkflowRunRecord, ctx: NodeExecutionContext): Promise<NodeResult> {
    ctx.logger.log(`Executing parallel node ${node.id}`);

    const parallelNodeIds = (node.metadata as any)?.parallelNodes as string[];
    if (!parallelNodeIds || parallelNodeIds.length === 0) {
      throw new Error(`Parallel node ${node.id} missing parallelNodes in metadata`);
    }

    const def = ctx.getDefinition(run.workflowDefId);
    if (!def) throw new Error(`Workflow definition ${run.workflowDefId} not found`);

    const parallelNodes = parallelNodeIds
      .map(id => def.nodes.find(n => n.id === id))
      .filter(Boolean) as WorkflowNode[];

    if (parallelNodes.length === 0) {
      throw new Error(`No valid parallel nodes found for node ${node.id}`);
    }

    ctx.logger.log(`Executing ${parallelNodes.length} nodes in parallel: ${parallelNodeIds.join(', ')}`);

    // Emit parallel execution start event (Req 9)
    this.websocketGateway.sendToProject(run.projectId, {
      type: 'workflow:state_changed',
      data: {
        workflowRunId: run.id,
        projectId: run.projectId,
        previousState: 'running',
        currentState: 'parallel_execution',
        currentNodeId: node.id,
        timestamp: new Date()
      } as WorkflowStateChangedEvent,
      timestamp: new Date()
    });

    // Execute all parallel nodes concurrently (Req 26)
    const results = await Promise.allSettled(
      parallelNodes.map(parallelNode => {
        ctx.logger.log(`Starting parallel execution of node ${parallelNode.id}`);
        return ctx.executeNode(parallelNode, run);
      })
    );

    // Analyze results
    const successfulResults = results.filter(
      r => r.status === 'fulfilled' && r.value.status === 'success'
    );
    const failedResults = results.filter(
      r => r.status === 'rejected' || (r.status === 'fulfilled' && r.value.status === 'failure')
    );

    const allSucceeded = failedResults.length === 0;
    const errors = failedResults.map((r: any) => {
      if (r.status === 'rejected') {
        return r.reason?.message || 'Unknown error';
      } else {
        return r.value?.error || 'Unknown error';
      }
    });

    ctx.logger.log(
      `Parallel execution complete: ${successfulResults.length}/${parallelNodes.length} succeeded, ${failedResults.length} failed`
    );

    // Emit parallel execution complete event (Req 9)
    this.websocketGateway.sendToProject(run.projectId, {
      type: 'workflow:state_changed',
      data: {
        workflowRunId: run.id,
        projectId: run.projectId,
        previousState: 'parallel_execution',
        currentState: allSucceeded ? 'parallel_success' : 'parallel_partial_failure',
        currentNodeId: node.id,
        timestamp: new Date()
      } as WorkflowStateChangedEvent,
      timestamp: new Date()
    });

    return {
      status: allSucceeded ? 'success' : 'failure',
      output: {
        results: results.map((r: any, index) => ({
          nodeId: parallelNodes[index].id,
          status: r.status,
          value: r.status === 'fulfilled' ? r.value : undefined,
          reason: r.status === 'rejected' ? r.reason?.message : undefined
        })),
        allSucceeded,
        successCount: successfulResults.length,
        failureCount: failedResults.length,
        totalCount: parallelNodes.length
      },
      error: errors.length > 0 ? errors.join('; ') : undefined
    };
  }
}

import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { NodeResult, WorkflowDefinition, WorkflowNode, WorkflowStateChangedEvent } from '@ai-corp/shared-types';
import { WorkflowGraph } from '../../../domain/workflow/WorkflowGraph';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { IWorkflowEngineRepository, WORKFLOW_ENGINE_REPOSITORY, WorkflowRunRecord } from '../persistence/workflow-engine.repository';
import { WorkflowEngine } from '../workflow.engine';
import { NodeExecutionContext, NodeExecutionStrategy } from './node-execution-strategy';

interface ChildOutcome {
  status: 'completed' | 'failed';
  error?: string;
  visitedNodes: string[];
}

/**
 * Executes a sub_workflow node (Task 16, Composite pattern): the node is itself a workflow.
 *
 * The child definition runs inline, inside the parent's node, as its own WorkflowRun
 * (parentRunId/parentNodeId set), so every child node is logged as a step of the child run and
 * the UI can show the hierarchy. Running inline instead of through the queue means the parent
 * simply awaits the child: no polling, and no queue slot held while waiting for another job.
 *
 * Context isolation: the child starts with a deep copy of the parent's variables (only
 * metadata.inputs when given) and the parent only sees the child's variables (only
 * metadata.outputs when given) once the child completed. A failed child changes nothing in the
 * parent.
 *
 * Recursion: the registry rejects a workflow that references itself and pins every reference to
 * an already registered version, so reference cycles cannot be built; MAX_DEPTH guards nesting
 * at run time as well.
 *
 * Registers itself with the engine at module init (Open/Closed), like QualityGateStrategy.
 */
@Injectable()
export class SubWorkflowStrategy implements NodeExecutionStrategy, OnModuleInit {
  readonly type = 'sub_workflow' as const;
  static readonly MAX_DEPTH = 5;
  /** Same loop protection as the engine applies to top-level runs */
  static readonly MAX_NODE_VISITS = 3;
  /** Base delay between retries of a child node (doubled per attempt); tests set it to 0 */
  static retryDelayMs = 1000;

  constructor(
    private readonly engine: WorkflowEngine,
    @Inject(WORKFLOW_ENGINE_REPOSITORY) private readonly repository: IWorkflowEngineRepository,
    private readonly websocketGateway: AppWebSocketGateway
  ) {}

  onModuleInit(): void {
    this.engine.registerStrategy(this);
  }

  async execute(node: WorkflowNode, run: WorkflowRunRecord, ctx: NodeExecutionContext): Promise<NodeResult> {
    if (!node.subWorkflowId) {
      return { status: 'failure', error: `Sub-workflow node ${node.id} is missing subWorkflowId` };
    }
    const sub = ctx.getDefinition(node.subWorkflowId, node.subWorkflowVersion);
    if (!sub) {
      return { status: 'failure', error: `Sub-workflow ${node.subWorkflowId}@${node.subWorkflowVersion || 'latest'} is not registered` };
    }

    const parentContext = SubWorkflowStrategy.contextOf(run);
    const depth = Number(parentContext._subWorkflowDepth || 0) + 1;
    if (depth > SubWorkflowStrategy.MAX_DEPTH) {
      return { status: 'failure', error: `Sub-workflow nesting deeper than ${SubWorkflowStrategy.MAX_DEPTH} levels at node ${node.id}` };
    }

    const metadata = (node.metadata || {}) as Record<string, unknown>;
    const inputs = SubWorkflowStrategy.keyList(metadata.inputs);
    const outputs = SubWorkflowStrategy.keyList(metadata.outputs);
    const parentVars = parentContext.variables as Record<string, unknown>;

    const childContext = {
      projectId: run.projectId,
      goal: parentContext.goal,
      variables: SubWorkflowStrategy.clone(SubWorkflowStrategy.pick(parentVars, inputs)),
      _subWorkflowDepth: depth,
    };
    const child = await this.repository.createRun({
      projectId: run.projectId,
      workflowDefId: sub.id,
      workflowDefVersion: sub.version,
      parentRunId: run.id,
      parentNodeId: node.id,
      status: 'running',
      currentNodeId: sub.startNode,
      context: childContext,
    });
    ctx.logger.log(`Sub-workflow ${sub.id}@${sub.version} started as run ${child.id} (node ${node.id} of run ${run.id}, depth ${depth})`);
    this.emit(child, 'pending', 'running', sub.startNode);

    const outcome = await this.runToCompletion(child, sub, ctx);
    this.emit(child, 'running', outcome.status, child.currentNodeId || undefined);

    if (outcome.status === 'failed') {
      return { status: 'failure', error: `Sub-workflow ${sub.id} failed: ${outcome.error}` };
    }

    const childVars = SubWorkflowStrategy.contextOf(child).variables as Record<string, unknown>;
    const returned = SubWorkflowStrategy.clone(SubWorkflowStrategy.pick(childVars, outputs));
    Object.assign(parentVars, returned);
    await this.repository.updateRun(run.id, { context: run.context as any });

    return {
      status: 'success',
      output: {
        subWorkflowId: sub.id,
        subWorkflowVersion: sub.version,
        subWorkflowRunId: child.id,
        visitedNodes: outcome.visitedNodes,
        returnedVariables: Object.keys(returned),
        edgeCondition: 'onSuccess',
      },
    };
  }

  /** Walk the child graph node by node until it completes or fails */
  private async runToCompletion(child: WorkflowRunRecord, sub: WorkflowDefinition, ctx: NodeExecutionContext): Promise<ChildOutcome> {
    const graph = new WorkflowGraph(sub);
    const visits = new Map<string, number>();
    const visitedNodes: string[] = [];
    let currentId = graph.startNodeId;

    const finish = async (status: 'completed' | 'failed', error?: string): Promise<ChildOutcome> => {
      await this.repository.updateRun(child.id, { status, completedAt: new Date(), context: child.context as any });
      child.status = status;
      if (error) ctx.logger.error(`Sub-workflow run ${child.id} failed: ${error}`);
      return { status, error, visitedNodes };
    };

    for (;;) {
      const count = (visits.get(currentId) || 0) + 1;
      visits.set(currentId, count);
      if (count > SubWorkflowStrategy.MAX_NODE_VISITS) {
        return finish('failed', `Loop detected: node ${currentId} visited ${count} times`);
      }
      visitedNodes.push(currentId);
      child.currentNodeId = currentId;
      await this.repository.updateRun(child.id, { currentNodeId: currentId });

      const node = graph.requireNode(currentId);
      const result = await this.executeWithRetry(node, child, ctx);

      const transition = result.status === 'success'
        ? graph.next(currentId, (result.output as any)?.edgeCondition || 'onSuccess')
        : graph.nextAfterFailure(currentId, result.error);

      if (transition.kind === 'next') {
        currentId = transition.nodeId;
        continue;
      }
      if (transition.kind === 'complete') return finish('completed');
      return finish('failed', transition.reason);
    }
  }

  private async executeWithRetry(node: WorkflowNode, child: WorkflowRunRecord, ctx: NodeExecutionContext): Promise<NodeResult> {
    const maxRetries = node.maxRetries ?? 0;
    let lastError = '';
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (attempt > 0 && SubWorkflowStrategy.retryDelayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, SubWorkflowStrategy.retryDelayMs * Math.pow(2, attempt - 1)));
      }
      try {
        // The engine's executeNode throws when a node reports failure
        return await ctx.executeNode(node, child);
      } catch (error) {
        lastError = (error as Error).message;
        ctx.logger.warn(`Sub-workflow node ${node.id} failed (attempt ${attempt + 1}/${maxRetries + 1}): ${lastError}`);
      }
    }
    return { status: 'failure', error: lastError };
  }

  private emit(child: WorkflowRunRecord, previousState: string, currentState: string, nodeId?: string): void {
    const event: WorkflowStateChangedEvent = {
      workflowRunId: child.id,
      projectId: child.projectId,
      previousState,
      currentState,
      currentNodeId: nodeId,
      timestamp: new Date(),
    };
    this.websocketGateway.sendToProject(child.projectId, { type: 'workflow:state_changed', data: event });
  }

  /** The run's context object with a variables map, created if missing */
  private static contextOf(run: WorkflowRunRecord): Record<string, unknown> {
    const context = (run.context && typeof run.context === 'object' ? run.context : {}) as Record<string, unknown>;
    run.context = context;
    if (!context.variables || typeof context.variables !== 'object') context.variables = {};
    return context;
  }

  private static keyList(value: unknown): string[] | undefined {
    return Array.isArray(value) ? value.map(String) : undefined;
  }

  private static pick(source: Record<string, unknown>, keys?: string[]): Record<string, unknown> {
    if (!keys) return { ...source };
    const picked: Record<string, unknown> = {};
    for (const key of keys) {
      if (key in source) picked[key] = source[key];
    }
    return picked;
  }

  private static clone<T>(value: T): T {
    return value === undefined ? value : JSON.parse(JSON.stringify(value));
  }
}

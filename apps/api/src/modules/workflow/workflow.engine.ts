import { Inject, Injectable, Logger } from '@nestjs/common';
import { WorkflowDefinition, WorkflowNode, WorkflowContext, NodeResult, NodeType } from '@ai-corp/shared-types';
import { WorkflowDefinitionRegistry } from './workflow-definition.registry';
import { WorkflowGraph } from '../../domain/workflow/WorkflowGraph';
import { WorkflowRunMemento } from '../../domain/workflow/WorkflowRunMemento';
import { WorkflowSnapshotCaretaker, RollbackTarget } from './snapshots/workflow-snapshot.caretaker';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { WorkflowStateChangedEvent } from '@ai-corp/shared-types';
import { AgentOrchestratorService } from '../orchestrator/agent-orchestrator.service';
import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';
import { EventBus } from '../../domain/events/EventBus';
import { WorkflowStartedEvent } from '../../domain/events/WorkflowStartedEvent';
import { WorkflowFailedEvent } from '../../domain/events/WorkflowFailedEvent';
import { WorkflowCompletedEvent } from '../../domain/events/WorkflowCompletedEvent';
import {
  IMilestoneRepository,
  ITaskRepository,
  MILESTONE_REPOSITORY,
  TASK_REPOSITORY,
} from '../../domain/repositories';
import {
  WORKFLOW_ENGINE_REPOSITORY,
  IWorkflowEngineRepository,
  WorkflowRunRecord,
} from './persistence/workflow-engine.repository';
import {
  NodeExecutionStrategy,
  NodeExecutionContext,
  AgentTaskStrategy,
  HumanApprovalStrategy,
  ConditionStrategy,
  ParallelStrategy,
} from './strategies';

interface WorkflowJobData {
  runId: string;
  nodeId: string;
  retryCount: number;
}

// Simple in-memory cache with TTL for workflow context
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

@Injectable()
export class WorkflowEngine {
  private readonly logger = new Logger(WorkflowEngine.name);
  private readonly definitions = new WorkflowDefinitionRegistry();
  private readonly snapshots: WorkflowSnapshotCaretaker;
  private workflowQueue: Queue<WorkflowJobData> | null = null;
  private workflowWorker: Worker<WorkflowJobData> | null = null;
  private redisConnection: ConnectionOptions;
  private contextCache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds
  private redisAvailable = false;
  private readonly strategies = new Map<NodeType, NodeExecutionStrategy>();

  constructor(
    @Inject(WORKFLOW_ENGINE_REPOSITORY) private readonly repository: IWorkflowEngineRepository,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly eventBus: EventBus,
    @Inject(MILESTONE_REPOSITORY) private readonly milestoneRepository: IMilestoneRepository,
    @Inject(TASK_REPOSITORY) private readonly taskRepository: ITaskRepository
  ) {
    this.snapshots = new WorkflowSnapshotCaretaker(this.repository);

    // One strategy per node type (Strategy pattern)
    this.registerStrategy(new AgentTaskStrategy(
      this.repository,
      this.websocketGateway,
      this.orchestrator,
      this.milestoneRepository,
      this.taskRepository
    ));
    this.registerStrategy(new HumanApprovalStrategy(this.repository, this.websocketGateway, this.eventBus));
    this.registerStrategy(new ConditionStrategy(this.websocketGateway));
    this.registerStrategy(new ParallelStrategy(this.websocketGateway));

    // Initialize Redis connection options
    this.redisConnection = {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      maxRetriesPerRequest: null,
    };

    this.initBullMQ();
  }

  private async initBullMQ() {
    try {
      // Verify Redis is actually reachable before marking as available
      const host = process.env.REDIS_HOST || 'localhost';
      const port = parseInt(process.env.REDIS_PORT || '6379');
      await new Promise<void>((resolve, reject) => {
        const socket = require('net').createConnection({ host, port }, () => {
          socket.end();
          resolve();
        });
        socket.on('error', reject);
        socket.setTimeout(2000, () => { socket.destroy(); reject(new Error('Redis connection timeout')); });
      });

      this.workflowQueue = new Queue<WorkflowJobData>('workflow-execution', {
        connection: this.redisConnection,
      });

      this.workflowWorker = new Worker<WorkflowJobData>(
        'workflow-execution',
        async (job: Job<WorkflowJobData>) => {
          // A node that still fails after its retries ends the job here, so the run follows its
          // onFail edge or is marked failed instead of staying 'running' forever
          const result: NodeResult = await this.executeNodeJob(job.data)
            .catch((err: Error) => ({ status: 'failure' as const, error: err.message }));
          await this.handleJobCompletion(job.data.runId, job.data.nodeId, result);
          return result;
        },
        {
          connection: this.redisConnection,
          concurrency: 5,
        }
      );

      this.workflowWorker.on('completed', (job) => {
        this.logger.log(`Workflow job ${job.id} completed successfully`);
      });

      this.workflowWorker.on('failed', (job, err) => {
        this.logger.error(`Workflow job ${job?.id} failed: ${err.message}`);
      });

      this.redisAvailable = true;
      this.logger.log('WorkflowEngine initialized with BullMQ');
    } catch (err) {
      this.redisAvailable = false;
      this.logger.warn(`BullMQ unavailable, using degraded mode (direct execution): ${(err as Error).message}`);
    }
  }

  async onModuleDestroy() {
    if (this.workflowQueue) await this.workflowQueue.close();
    if (this.workflowWorker) await this.workflowWorker.close();
  }

  /**
   * Registers the strategy that executes nodes of `strategy.type`.
   * New node types are added here without changing executeNode (Open/Closed Principle).
   */
  registerStrategy(strategy: NodeExecutionStrategy): void {
    this.strategies.set(strategy.type, strategy);
  }

  /**
   * Registers a workflow definition (validated, immutable per id@version) and returns the
   * registered form, whose sub-workflow references are pinned to a version.
   */
  createWorkflow(def: WorkflowDefinition): WorkflowDefinition {
    const registered = this.definitions.register(def);
    this.logger.log(`Registered workflow definition: ${registered.id}@${registered.version}`);
    return registered;
  }

  /** A registered definition; the latest version when none is given */
  getDefinition(workflowDefId: string, version?: string | null): WorkflowDefinition | undefined {
    return this.definitions.get(workflowDefId, version);
  }

  /** Latest version of every registered definition */
  listDefinitions(): WorkflowDefinition[] {
    return this.definitions.list();
  }

  versionsOf(workflowDefId: string): WorkflowDefinition[] {
    return this.definitions.versionsOf(workflowDefId);
  }

  /** The definition a run executes: the version it was started with (latest for runs from before versioning) */
  definitionOf(run: Pick<WorkflowRunRecord, 'workflowDefId' | 'workflowDefVersion'>): WorkflowDefinition | undefined {
    return this.definitions.get(run.workflowDefId, run.workflowDefVersion);
  }

  /**
   * Starts a new workflow execution run, pinned to `version` (or the latest registered version).
   */
  async startWorkflow(projectId: string, workflowDefId: string, context: WorkflowContext, version?: string) {
    const def = this.definitions.get(workflowDefId, version);
    if (!def) {
      throw new Error(`Workflow definition ${workflowDefId}${version ? `@${version}` : ''} not found.`);
    }

    const run = await this.repository.createRun({
      projectId,
      workflowDefId,
      workflowDefVersion: def.version,
      status: 'running',
      currentNodeId: def.startNode,
      context: context as any,
    });

    this.logger.log(`Started workflow run ${run.id} for project ${projectId}`);
    
    // Publish WorkflowStartedEvent via injected EventBus (satisfies DIP)
    await this.eventBus.publish(new WorkflowStartedEvent(
      run.id,
      projectId,
      workflowDefId,
      context.variables?.startedBy as string | undefined
    )).catch(err => this.logger.error(`Failed to publish WorkflowStartedEvent: ${err.message}`));
    
    // Emit state changed event
    const event: WorkflowStateChangedEvent = {
      workflowRunId: run.id,
      projectId: run.projectId,
      previousState: 'pending',
      currentState: run.status,
      currentNodeId: run.currentNodeId || undefined,
      timestamp: new Date()
    };
    this.websocketGateway.sendToProject(run.projectId, { type: 'workflow:state_changed', data: event });

    // Automatically start processing the first node
    this.processCurrentNode(run.id).catch(e => this.logger.error(`Error processing run ${run.id}: ${e.message}`));

    return run;
  }

  /**
   * Gets the current node configuration for a given run.
   * Uses in-memory cache with TTL to reduce database reads (Task 33.2)
   */
  async getCurrentNode(runId: string): Promise<WorkflowNode | null> {
    const cacheKey = `currentNode:${runId}`;
    const cached = this.getFromCache<WorkflowNode | null>(cacheKey);
    if (cached !== undefined) return cached;

    const run = await this.repository.findRunById(runId);
    if (!run || !run.currentNodeId) {
      this.setCache(cacheKey, null);
      return null;
    }

    const def = this.definitionOf(run);
    if (!def) {
      this.setCache(cacheKey, null);
      return null;
    }

    const node = def.nodes.find((n: any) => n.id === run.currentNodeId) || null;
    this.setCache(cacheKey, node);
    return node;
  }

  /**
   * Invalidate cache for a workflow run
   */
  private invalidateRunCache(runId: string): void {
    this.contextCache.delete(`currentNode:${runId}`);
  }

  /**
   * Transitions a running workflow to the next node based on conditions.
   * After a failed node (nodeFailed) only an explicit onFail edge is followed; without one the run fails.
   */
  async transitionToNextNode(runId: string, edgeCondition?: string, nodeFailed = false): Promise<void> {
    const run = await this.repository.findRunById(runId);
    if (!run) throw new Error('Run not found');

    const def = this.definitionOf(run);
    if (!def) throw new Error('Workflow Definition not found');

    if (run.status !== 'running') {
      throw new Error(`Cannot transition run ${runId} because it is ${run.status}`);
    }

    const currentNodeId = run.currentNodeId;
    if (!currentNodeId) return;

    const graph = new WorkflowGraph(def);
    const transition = nodeFailed ? graph.nextAfterFailure(currentNodeId) : graph.next(currentNodeId, edgeCondition);

    if (transition.kind === 'complete') {
      // Reached the end
      await this.repository.updateRun(runId, { status: 'completed', completedAt: new Date() });

      // Update the project status to completed
      await this.repository.updateProjectStatus(run.projectId, 'completed');

      this.logger.log(`Workflow run ${runId} completed. Project ${run.projectId} marked as completed.`);
      
      // Publish WorkflowCompletedEvent via injected EventBus (satisfies DIP)
      await this.eventBus.publish(new WorkflowCompletedEvent(
        run.projectId,
        run.id
      )).catch(err => this.logger.error(`Failed to publish WorkflowCompletedEvent: ${err.message}`));
      
      const event: WorkflowStateChangedEvent = {
        workflowRunId: run.id,
        projectId: run.projectId,
        previousState: run.status,
        currentState: 'completed',
        timestamp: new Date()
      };
      this.websocketGateway.sendToProject(run.projectId, { type: 'workflow:state_changed', data: event });
      return;
    }

    if (transition.kind === 'dead_end') {
      await this.repository.updateRun(runId, { status: 'failed', completedAt: new Date() });
      this.logger.error(`Failed to transition run ${runId}: ${transition.reason}`);
      await this.publishFailure(run.projectId, run.id, currentNodeId, transition.reason);
      
      const event: WorkflowStateChangedEvent = {
        workflowRunId: run.id,
        projectId: run.projectId,
        previousState: run.status,
        currentState: 'failed',
        timestamp: new Date()
      };
      this.websocketGateway.sendToProject(run.projectId, { type: 'workflow:state_changed', data: event });
      return;
    }
    const nextNodeId = transition.nodeId;

    // Track visited nodes to prevent infinite loops in conditional cycles (Task: loop protection)
    const MAX_NODE_VISITS = 3;
    const context = (run.context as any) || {};
    if (!context._visitedNodes) context._visitedNodes = {};
    const visitCount = (context._visitedNodes[nextNodeId] || 0) + 1;

    if (visitCount > MAX_NODE_VISITS) {
      this.logger.error(`Loop detected: Node ${nextNodeId} visited ${visitCount} times in run ${runId}. Failing workflow.`);
      await this.repository.updateRun(runId, { status: 'failed', completedAt: new Date(), context: context as any });
      await this.publishFailure(run.projectId, run.id, nextNodeId, `Loop limit: node ${nextNodeId} visited ${visitCount} times`);

      const event: WorkflowStateChangedEvent = {
        workflowRunId: run.id,
        projectId: run.projectId,
        previousState: run.status,
        currentState: 'failed',
        timestamp: new Date()
      };
      this.websocketGateway.sendToProject(run.projectId, { type: 'workflow:state_changed', data: event });
      return;
    }

    context._visitedNodes[nextNodeId] = visitCount;

    await this.repository.updateRun(runId, { currentNodeId: nextNodeId, context: context as any });

    // Invalidate cache after state change (Task 33.2)
    this.invalidateRunCache(runId);

    this.logger.log(`Transitioned run ${runId} to node ${nextNodeId}`);
    
    const event: WorkflowStateChangedEvent = {
      workflowRunId: run.id,
      projectId: run.projectId,
      previousState: run.status,
      currentState: run.status,
      currentNodeId: nextNodeId,
      timestamp: new Date()
    };
    this.websocketGateway.sendToProject(run.projectId, { type: 'workflow:state_changed', data: event });
  }

  /**
   * Pause a workflow execution
   */
  async pauseWorkflow(runId: string): Promise<void> {
    const run = await this.repository.findRunById(runId);
    if (!run) throw new Error(`Workflow run ${runId} not found`);
    
    if (run.status !== 'running') {
      throw new Error(`Cannot pause workflow ${runId} with status ${run.status}`);
    }

    await this.saveWorkflowState(runId);
    
    await this.repository.updateRun(runId, { status: 'paused' });

    this.logger.log(`Workflow run ${runId} paused`);
    
    const event: WorkflowStateChangedEvent = {
      workflowRunId: run.id,
      projectId: run.projectId,
      previousState: 'running',
      currentState: 'paused',
      currentNodeId: run.currentNodeId || undefined,
      timestamp: new Date()
    };
    this.websocketGateway.sendToProject(run.projectId, { type: 'workflow:state_changed', data: event });
  }

  /**
   * Resume a paused workflow execution
   * @param skipProcessNode If true, don't auto-process the current node (used when approval transitions to next node)
   */
  async resumeWorkflow(runId: string, skipProcessNode = false): Promise<void> {
    const run = await this.repository.findRunById(runId);
    if (!run) throw new Error(`Workflow run ${runId} not found`);
    
    if (run.status !== 'paused') {
      throw new Error(`Cannot resume workflow ${runId} with status ${run.status}`);
    }

    await this.repository.updateRun(runId, { status: 'running' });

    this.logger.log(`Workflow run ${runId} resumed`);
    
    const event: WorkflowStateChangedEvent = {
      workflowRunId: run.id,
      projectId: run.projectId,
      previousState: 'paused',
      currentState: 'running',
      currentNodeId: run.currentNodeId || undefined,
      timestamp: new Date()
    };
    this.websocketGateway.sendToProject(run.projectId, { type: 'workflow:state_changed', data: event });

    // Continue processing from current node (unless caller will handle it)
    if (!skipProcessNode) {
      await this.processCurrentNode(runId);
    }
  }

  /**
   * Snapshots of a run, oldest first (Task 17)
   */
  async listSnapshots(runId: string) {
    return this.snapshots.list(runId);
  }

  /**
   * Roll a paused or failed run back to a snapshot (Memento restore, Task 17).
   * The run gets the node and context it had before that node ran, and is left paused so a person
   * can look at it before resuming. Snapshots after the target are discarded (the target itself
   * too: it is taken again when the node re-runs) and pending approvals of the run are cancelled.
   */
  async rollbackWorkflow(runId: string, target: RollbackTarget): Promise<{ run: WorkflowRunRecord; snapshot: WorkflowRunMemento; cancelledApprovals: number }> {
    const run = await this.repository.findRunById(runId);
    if (!run) throw new Error(`Workflow run ${runId} not found`);
    if (run.parentRunId) {
      throw new Error(`Run ${runId} is a sub-workflow run; roll back its parent run ${run.parentRunId} instead`);
    }
    if (run.status !== 'paused' && run.status !== 'failed') {
      throw new Error(`Cannot roll back workflow ${runId} with status ${run.status}: pause it first (only paused or failed runs can be rolled back)`);
    }

    const memento = await this.snapshots.select(runId, target);
    const def = this.definitionOf(run);
    if (!def?.nodes.some(n => n.id === memento.nodeId)) {
      throw new Error(`Snapshot node ${memento.nodeId} is not in workflow ${run.workflowDefId}@${run.workflowDefVersion}`);
    }

    await this.repository.updateRun(runId, {
      status: 'paused',
      currentNodeId: memento.nodeId,
      context: memento.context() as any,
      completedAt: null,
    });
    await this.snapshots.discardFrom(runId, memento.sequence);
    const cancelledApprovals = await this.repository.cancelPendingApprovals(runId);
    this.invalidateRunCache(runId);

    this.logger.log(`Workflow run ${runId} rolled back to snapshot #${memento.sequence} (node ${memento.nodeId})`);

    const event: WorkflowStateChangedEvent = {
      workflowRunId: run.id,
      projectId: run.projectId,
      previousState: run.status,
      currentState: 'paused',
      currentNodeId: memento.nodeId,
      timestamp: new Date()
    };
    this.websocketGateway.sendToProject(run.projectId, { type: 'workflow:state_changed', data: event });

    const restored = await this.repository.findRunById(runId);
    return { run: restored!, snapshot: memento, cancelledApprovals };
  }

  /**
   * Save workflow state for recovery
   */
  /** Phase 5: a run that stopped in `failed` is audited and reaches webhooks */
  private async publishFailure(projectId: string, runId: string, nodeId: string | null, reason: string): Promise<void> {
    await this.eventBus
      .publish(new WorkflowFailedEvent(projectId, runId, nodeId, reason))
      .catch(err => this.logger.error(`Failed to publish WorkflowFailedEvent: ${err.message}`));
  }

  private async saveWorkflowState(runId: string): Promise<void> {
    const run = await this.repository.findRunById(runId);
    if (!run) return;

    // State is persisted in database through currentNodeId and context
    // This is the primary source of truth for workflow recovery
    this.logger.log(`Saved workflow state for run ${runId} in database`);
  }

  /**
   * Recover running workflows on system restart
   */
  async recoverWorkflows(): Promise<void> {
    try {
      const runningWorkflows = await this.repository.findRunsByStatus('running');

      this.logger.log(`Recovering ${runningWorkflows.length} running workflows`);

      for (const run of runningWorkflows) {
        try {
          this.logger.log(`Recovering workflow ${run.id} from database state`);
          
          // Resume processing
          this.processCurrentNode(run.id).catch(err => {
            this.logger.error(`Failed to recover workflow ${run.id}: ${err.message}`);
          });
        } catch (error) {
          this.logger.error(`Error recovering workflow ${run.id}: ${(error as Error).message}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Workflow recovery failed (DB may be unavailable): ${(error as Error).message}`);
    }
  }

  /**
   * Execute a node job with retry logic and timeout handling
   * Implements Requirement 19: Error handling and retry logic with exponential backoff
   * - Retries failed steps up to maxRetries (default 3)
   * - Uses exponential backoff: 2^retryCount seconds between retries
   * - Enforces node timeout (default 5 minutes)
   */
  private async executeNodeJob(jobData: WorkflowJobData): Promise<NodeResult> {
    const { runId, nodeId, retryCount } = jobData;

    const run = await this.repository.findRunById(runId);
    if (!run || run.status !== 'running') {
      throw new Error(`Workflow run ${runId} is not running`);
    }

    const def = this.definitionOf(run);
    if (!def) throw new Error(`Workflow definition ${run.workflowDefId} not found`);

    const node = def.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found in workflow definition`);

    // Memento of the run before the node runs (once per node, not per retry) - Task 17
    if (retryCount === 0) {
      await this.snapshots.capture(run).catch(err =>
        this.logger.warn(`Could not snapshot run ${runId} before node ${nodeId}: ${(err as Error).message}`)
      );
    }

    const maxRetries = node.maxRetries ?? 3;
    const timeout = node.timeout ?? 300000; // Default 5 minutes (Req 19)

    try {
      // Execute with timeout (Req 19); the timer is cleared once the node settles
      let timer: NodeJS.Timeout | undefined;
      try {
        return await Promise.race([
          this.executeNode(node, run),
          this.createTimeoutPromise(timeout, `Node ${nodeId} execution timeout after ${timeout}ms`, t => (timer = t))
        ]);
      } finally {
        if (timer) clearTimeout(timer);
      }
    } catch (error) {
      const errorMessage = (error as Error).message;
      this.logger.error(`Node ${nodeId} execution failed (attempt ${retryCount + 1}/${maxRetries + 1}): ${errorMessage}`);

      if (retryCount < maxRetries) {
        // Retry with exponential backoff: 2^retryCount seconds (Req 19)
        const backoffDelay = Math.pow(2, retryCount) * 1000;
        this.logger.log(`Retrying node ${nodeId} after ${backoffDelay}ms (exponential backoff)`);
        
        // Emit retry event
        this.websocketGateway.sendToProject(run.projectId, {
          type: 'workflow:state_changed',
          data: {
            workflowRunId: run.id,
            projectId: run.projectId,
            previousState: 'failed',
            currentState: 'retrying',
            currentNodeId: node.id,
            timestamp: new Date()
          } as WorkflowStateChangedEvent,
          timestamp: new Date()
        });

        await this.delay(backoffDelay);
        
        return this.executeNodeJob({
          runId,
          nodeId,
          retryCount: retryCount + 1
        });
      }

      // Max retries exceeded (Req 19)
      this.logger.error(`Node ${nodeId} failed after ${maxRetries + 1} attempts`);
      throw error;
    }
  }

  /**
   * Execute a single workflow node based on its type
   * Implements Requirements 2, 9, 19:
   * - Req 2: DAG-based workflow orchestration with node execution
   * - Req 9: WebSocket events for state changes
   * - Req 19: Error handling and retry logic
   */
  private async executeNode(node: WorkflowNode, run: WorkflowRunRecord): Promise<NodeResult> {
    this.logger.log(`Executing node ${node.id} of type ${node.type}`);

    const step = await this.repository.createStep({
      workflowRunId: run.id,
      nodeId: node.id,
      agentRole: node.agentRole,
      status: 'running',
      startedAt: new Date(),
      retryCount: 0,
    });

    // Emit WebSocket event for node execution start (Req 9)
    const startEvent: WorkflowStateChangedEvent = {
      workflowRunId: run.id,
      projectId: run.projectId,
      previousState: 'pending',
      currentState: 'running',
      currentNodeId: node.id,
      timestamp: new Date()
    };
    this.websocketGateway.sendToProject(run.projectId, { 
      type: 'workflow:state_changed', 
      data: startEvent,
      timestamp: new Date()
    });

    try {
      const strategy = this.strategies.get(node.type);
      if (!strategy) {
        throw new Error(`Unsupported node type: ${node.type}`);
      }
      const result = await strategy.execute(node, run, this.nodeExecutionContext);

      // Calculate execution duration
      const completedAt = new Date();
      const durationMs = step.startedAt ? completedAt.getTime() - step.startedAt.getTime() : 0;

      // Update step with result
      await this.repository.updateStep(step.id, {
        status: result.status === 'success' ? 'completed' : result.status === 'failure' ? 'failed' : 'pending',
        output: result.output ? JSON.stringify(result.output) : undefined,
        error: result.error,
        completedAt,
        durationMs,
      });

      // Structured logging for workflow step
      this.logger.log(JSON.stringify({
        event: 'workflow_step',
        workflowRunId: run.id,
        projectId: run.projectId,
        nodeId: node.id,
        nodeType: node.type,
        agentRole: node.agentRole,
        status: result.status === 'success' ? 'completed' : 'failed',
        durationMs,
        error: result.error,
      }));

      // Emit WebSocket event for node completion (Req 9)
      const completionEvent: WorkflowStateChangedEvent = {
        workflowRunId: run.id,
        projectId: run.projectId,
        previousState: 'running',
        currentState: result.status === 'success' ? 'completed' : result.status === 'failure' ? 'failed' : 'pending',
        currentNodeId: node.id,
        timestamp: new Date()
      };
      this.websocketGateway.sendToProject(run.projectId, { 
        type: 'workflow:state_changed', 
        data: completionEvent,
        timestamp: new Date()
      });

      // If result is failure, throw error for retry logic to handle (Req 19)
      if (result.status === 'failure') {
        throw new Error(result.error || `Node ${node.id} execution failed`);
      }

      return result;
    } catch (error) {
      await this.repository.updateStep(step.id, {
        status: 'failed',
        error: (error as Error).message,
        completedAt: new Date()
      });

      // Emit WebSocket event for node failure (Req 9)
      const failureEvent: WorkflowStateChangedEvent = {
        workflowRunId: run.id,
        projectId: run.projectId,
        previousState: 'running',
        currentState: 'failed',
        currentNodeId: node.id,
        timestamp: new Date()
      };
      this.websocketGateway.sendToProject(run.projectId, { 
        type: 'workflow:state_changed', 
        data: failureEvent,
        timestamp: new Date()
      });

      throw error;
    }
  }

  /**
   * Engine services a node strategy may call back into
   */
  private get nodeExecutionContext(): NodeExecutionContext {
    return {
      logger: this.logger,
      getDefinition: (workflowDefId, version) => this.definitions.get(workflowDefId, version),
      definitionOf: (run) => this.definitionOf(run),
      executeNode: (node, run) => this.executeNode(node, run),
    };
  }

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(ms: number, message: string, onTimer?: (timer: NodeJS.Timeout) => void): Promise<never> {
    return new Promise((_, reject) => {
      const timer = setTimeout(() => reject(new Error(message)), ms);
      onTimer?.(timer);
    });
  }

  /**
   * Delay helper for retry backoff
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Processes the current node if it's an agent node, and automates progression.
   * Implements Requirements 2, 26: Workflow orchestration with BullMQ task queuing
   * - Req 2: DAG-based workflow execution with node processing
   * - Req 26: Performance optimization with job queuing and concurrency control
   */
  async processCurrentNode(runId: string) {
    const run = await this.repository.findRunById(runId);
    if (!run || run.status !== 'running') return;

    const node = await this.getCurrentNode(runId);
    if (!node) return;

    // Add job to BullMQ queue for processing (Req 2, Req 26)
    const jobData: WorkflowJobData = {
      runId: run.id,
      nodeId: node.id,
      retryCount: 0
    };

    this.logger.log(`Processing workflow node: run=${runId}, node=${node.id}`);

    if (this.redisAvailable && this.workflowQueue) {
      try {
        // Add job to queue with priority based on node type
        const priority = node.type === 'human_approval' ? 1 : 10;
        await this.workflowQueue.add('process-node', jobData, {
          jobId: `${runId}-${node.id}`,
          priority,
          removeOnComplete: true,
          removeOnFail: false,
        });
        return; // Worker will process the job
      } catch (err) {
        this.logger.warn(`BullMQ enqueue failed, falling back to direct execution: ${(err as Error).message}`);
        this.redisAvailable = false;
      }
    }

    // Degraded mode: execute directly without queue
    this.logger.warn(`Executing node ${node.id} directly (no queue)`);
    this.executeNodeJob(jobData).then(async (result) => {
      await this.handleJobCompletion(runId, node.id, result);
    }).catch(async (err) => {
      this.logger.error(`Direct execution failed for node ${node.id}: ${err.message}`);
      await this.handleJobCompletion(runId, node.id, { status: 'failure', error: err.message });
    });
  }

  /**
   * Process job result and transition to next node
   * Called by BullMQ worker after job completion
   */
  private async handleJobCompletion(runId: string, nodeId: string, result: NodeResult): Promise<void> {
    const run = await this.repository.findRunById(runId);
    if (!run || run.status !== 'running') return;

    try {
      if (result.status === 'pending_approval') {
        // Pause workflow for human approval
        this.logger.log(`Reached human_approval node ${nodeId}. Pausing run ${runId}.`);
        await this.pauseWorkflow(runId);
        return;
      }

      // Determine edge condition for transition
      let edgeCondition: string | undefined;
      if (result.status === 'success') {
        edgeCondition = 'onSuccess';
        if (result.output && typeof result.output === 'object') {
          // Check if output contains specific edge condition
          edgeCondition = (result.output as any).edgeCondition || 'onSuccess';
        }
      } else if (result.status === 'failure') {
        edgeCondition = 'onFail';
      }

      await this.transitionToNextNode(runId, edgeCondition, result.status === 'failure');
      
      // Process next node by adding it to the queue
      await this.processCurrentNode(runId);
    } catch (error) {
      this.logger.error(`Error handling job completion for node ${nodeId}: ${(error as Error).message}`);
      await this.repository.updateRun(runId, { status: 'failed', completedAt: new Date() });
      
      const event: WorkflowStateChangedEvent = {
        workflowRunId: run.id,
        projectId: run.projectId,
        previousState: run.status,
        currentState: 'failed',
        timestamp: new Date()
      };
      this.websocketGateway.sendToProject(run.projectId, { type: 'workflow:state_changed', data: event });
    }
  }

  /**
   * Get value from cache if not expired
   */
  private getFromCache<T>(key: string): T | undefined {
    const entry = this.contextCache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.contextCache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  /**
   * Set value in cache with TTL
   */
  private setCache<T>(key: string, value: T): void {
    this.contextCache.set(key, {
      value,
      expiresAt: Date.now() + this.CACHE_TTL_MS,
    });
  }
}

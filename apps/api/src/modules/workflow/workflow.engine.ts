import { Injectable, Logger } from '@nestjs/common';
import { WorkflowDefinition, WorkflowNode, WorkflowContext, NodeResult } from '@ai-corp/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowValidator } from './workflow-validator';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { WorkflowStateChangedEvent } from '@ai-corp/shared-types';
import { AgentOrchestratorService } from '../orchestrator/agent-orchestrator.service';
import { Queue, Worker, Job, ConnectionOptions } from 'bullmq';

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
  private definitions = new Map<string, WorkflowDefinition>();
  private workflowQueue: Queue<WorkflowJobData> | null = null;
  private workflowWorker: Worker<WorkflowJobData> | null = null;
  private redisConnection: ConnectionOptions;
  private contextCache = new Map<string, CacheEntry<any>>();
  private readonly CACHE_TTL_MS = 30000; // 30 seconds
  private redisAvailable = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly orchestrator: AgentOrchestratorService
  ) {
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
          return this.executeNodeJob(job.data);
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
   * Registers a workflow definition into memory.
   */
  createWorkflow(def: WorkflowDefinition): void {
    WorkflowValidator.validate(def);
    this.definitions.set(def.id, def);
    this.logger.log(`Registered workflow definition: ${def.id}`);
  }

  /**
   * Starts a new workflow execution run.
   */
  async startWorkflow(projectId: string, workflowDefId: string, context: WorkflowContext) {
    const def = this.definitions.get(workflowDefId);
    if (!def) {
      throw new Error(`Workflow definition ${workflowDefId} not found.`);
    }

    const run = await this.prisma.workflowRun.create({
      data: {
        projectId,
        workflowDefId,
        status: 'running',
        currentNodeId: def.startNode,
        context: context as any,
      },
    });

    this.logger.log(`Started workflow run ${run.id} for project ${projectId}`);
    
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

    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run || !run.currentNodeId) {
      this.setCache(cacheKey, null);
      return null;
    }

    const def = this.definitions.get(run.workflowDefId);
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
   */
  async transitionToNextNode(runId: string, edgeCondition?: string): Promise<void> {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error('Run not found');

    const def = this.definitions.get(run.workflowDefId);
    if (!def) throw new Error('Workflow Definition not found');

    if (run.status !== 'running') {
      throw new Error(`Cannot transition run ${runId} because it is ${run.status}`);
    }

    const currentNodeId = run.currentNodeId;
    if (!currentNodeId) return;

    if (currentNodeId === def.endNode) {
      // Reached the end
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'completed', completedAt: new Date() }
      });
      this.logger.log(`Workflow run ${runId} completed.`);
      
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

    // Find valid outgoing edges
    const outgoingEdges = def.edges.filter((e: any) => e.from === currentNodeId);
    let nextNodeId: string | undefined;

    if (outgoingEdges.length === 1 && !outgoingEdges[0].condition) {
      nextNodeId = outgoingEdges[0].to;
    } else {
      // Find edge matching the evaluated condition
      const matchedEdge = outgoingEdges.find((e: any) => e.condition === edgeCondition);
      if (matchedEdge) {
        nextNodeId = matchedEdge.to;
      }
    }

    if (!nextNodeId) {
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'failed', completedAt: new Date() }
      });
      this.logger.error(`Failed to transition run ${runId}: No valid next node found for condition '${edgeCondition}'`);
      
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

    // Track visited nodes to prevent infinite loops in conditional cycles (Task: loop protection)
    const MAX_NODE_VISITS = 3;
    const context = (run.context as any) || {};
    if (!context._visitedNodes) context._visitedNodes = {};
    const visitCount = (context._visitedNodes[nextNodeId] || 0) + 1;

    if (visitCount > MAX_NODE_VISITS) {
      this.logger.error(`Loop detected: Node ${nextNodeId} visited ${visitCount} times in run ${runId}. Failing workflow.`);
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'failed', completedAt: new Date(), context: context as any }
      });

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

    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: { currentNodeId: nextNodeId, context: context as any }
    });

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
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error(`Workflow run ${runId} not found`);
    
    if (run.status !== 'running') {
      throw new Error(`Cannot pause workflow ${runId} with status ${run.status}`);
    }

    await this.saveWorkflowState(runId);
    
    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: { status: 'paused' }
    });

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
   */
  async resumeWorkflow(runId: string): Promise<void> {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run) throw new Error(`Workflow run ${runId} not found`);
    
    if (run.status !== 'paused') {
      throw new Error(`Cannot resume workflow ${runId} with status ${run.status}`);
    }

    await this.prisma.workflowRun.update({
      where: { id: runId },
      data: { status: 'running' }
    });

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

    // Continue processing from current node
    await this.processCurrentNode(runId);
  }

  /**
   * Save workflow state for recovery
   */
  private async saveWorkflowState(runId: string): Promise<void> {
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
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
      const runningWorkflows = await this.prisma.workflowRun.findMany({
        where: {
          status: 'running'
        }
      });

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

    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
    if (!run || run.status !== 'running') {
      throw new Error(`Workflow run ${runId} is not running`);
    }

    const def = this.definitions.get(run.workflowDefId);
    if (!def) throw new Error(`Workflow definition ${run.workflowDefId} not found`);

    const node = def.nodes.find(n => n.id === nodeId);
    if (!node) throw new Error(`Node ${nodeId} not found in workflow definition`);

    const maxRetries = node.maxRetries ?? 3;
    const timeout = node.timeout ?? 300000; // Default 5 minutes (Req 19)

    try {
      // Execute with timeout (Req 19)
      const result = await Promise.race([
        this.executeNode(node, run),
        this.createTimeoutPromise(timeout, `Node ${nodeId} execution timeout after ${timeout}ms`)
      ]);

      return result;
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
  private async executeNode(node: WorkflowNode, run: any): Promise<NodeResult> {
    this.logger.log(`Executing node ${node.id} of type ${node.type}`);

    const step = await this.prisma.workflowStep.create({
      data: {
        workflowRunId: run.id,
        nodeId: node.id,
        agentRole: node.agentRole,
        status: 'running',
        startedAt: new Date(),
        retryCount: 0,
      }
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
      let result: NodeResult;

      switch (node.type) {
        case 'agent_task':
          result = await this.executeAgentTask(node, run);
          break;
        case 'human_approval':
          result = await this.executeHumanApproval(node, run);
          break;
        case 'condition':
          result = await this.executeCondition(node, run);
          break;
        case 'parallel':
          result = await this.executeParallel(node, run);
          break;
        default:
          throw new Error(`Unsupported node type: ${node.type}`);
      }

      // Calculate execution duration
      const completedAt = new Date();
      const durationMs = step.startedAt ? completedAt.getTime() - step.startedAt.getTime() : 0;

      // Update step with result
      await this.prisma.workflowStep.update({
        where: { id: step.id },
        data: {
          status: result.status === 'success' ? 'completed' : result.status === 'failure' ? 'failed' : 'pending',
          output: result.output ? JSON.stringify(result.output) : undefined,
          error: result.error,
          completedAt,
          durationMs,
        }
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
      await this.prisma.workflowStep.update({
        where: { id: step.id },
        data: {
          status: 'failed',
          error: (error as Error).message,
          completedAt: new Date()
        }
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
   * Execute an agent task node
   * Implements Requirement 2: Workflow orchestration with agent task execution
   * Implements Requirement 9: WebSocket events for agent thinking and actions
   */
  private async executeAgentTask(node: WorkflowNode, run: any): Promise<NodeResult> {
    if (!node.agentRole) {
      throw new Error(`Agent task node ${node.id} missing agentRole`);
    }

    // Emit thinking event (Req 9)
    this.websocketGateway.sendToProject(run.projectId, {
      type: 'agent:thinking',
      data: {
        agentId: node.agentRole,
        agentRole: node.agentRole,
        taskId: node.id,
        message: `Analyzing task: ${node.taskType || node.id}...`
      },
      timestamp: new Date()
    });

    try {
      const workflowCtx = run.context as Record<string, unknown> || {};
      const vars = (workflowCtx.variables as Record<string, unknown>) || {};
      const agentInput: any = {
        projectId: run.projectId,
        taskId: node.id,
        task: (node as any).promptTemplate || node.taskType || 'Please proceed with the assigned task.',
        workflowRunId: run.id,
        projectContext: workflowCtx,
        relevantMemories: [],
        availableTools: [],
        goal: workflowCtx.goal || '',
        milestone: workflowCtx.milestone || '',
        code: workflowCtx.code || '',
        projectSummary: workflowCtx.projectSummary || workflowCtx.goal || '',
        ...vars,
      };
      const result = await this.orchestrator.invokeAgent(node.agentRole, agentInput);

      // Wire agent actions to task updates (Task 32.2)
      await this.updateTaskStatusForAgent(node.agentRole, run.projectId, result);

      // Emit action completion event (Req 9)
      this.websocketGateway.sendToProject(run.projectId, {
        type: 'agent:action',
        data: {
          agentId: node.agentRole,
          agentRole: node.agentRole,
          taskId: node.id,
          actionType: 'task_complete',
          toolName: node.taskType || 'general_task',
          parameters: result
        },
        timestamp: new Date()
      });

      return {
        status: 'success',
        output: result
      };
    } catch (error) {
      this.logger.error(`Agent task execution failed for node ${node.id}: ${(error as Error).message}`);
      return {
        status: 'failure',
        error: (error as Error).message
      };
    }
  }

  /**
   * Update task status based on agent role after successful execution
   * Implements Task 32.2: Wire agent actions to task updates
   */
  private async updateTaskStatusForAgent(agentRole: string, projectId: string, result: any): Promise<void> {
    try {
      // Find the most recent task for this project that is in_progress
      const task = await this.prisma.task.findFirst({
        where: {
          projectId,
          status: 'in_progress',
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!task) {
        this.logger.log(`No in_progress task found for project ${projectId}, skipping task status update`);
        return;
      }

      let newStatus: string | null = null;

      // When Dev agent completes → task goes to review
      if (agentRole === 'DEV') {
        newStatus = 'review';
      }
      // When QA agent approves → task goes to done
      else if (agentRole === 'QA') {
        // Check if QA result indicates approval
        const isApproved = result?.output?.approved !== false && result?.status !== 'failure';
        if (isApproved) {
          newStatus = 'done';
        }
      }

      if (newStatus) {
        await this.prisma.task.update({
          where: { id: task.id },
          data: { status: newStatus },
        });
        this.logger.log(`Updated task ${task.id} status to ${newStatus} after ${agentRole} agent completion`);

        // Emit WebSocket event for task status change
        this.websocketGateway.sendToProject(projectId, {
          type: 'task:updated',
          data: { taskId: task.id, status: newStatus, agentRole },
          timestamp: new Date(),
        });
      }
    } catch (error) {
      this.logger.error(`Failed to update task status for agent ${agentRole}: ${(error as Error).message}`);
    }
  }

  /**
   * Execute a human approval node
   * Implements Requirement 10: Human-in-the-loop approvals
   * Implements Requirement 9: WebSocket events for approval requests
   */
  private async executeHumanApproval(node: WorkflowNode, run: any): Promise<NodeResult> {
    this.logger.log(`Reached human approval node ${node.id} for workflow run ${run.id}`);

    // Get project owner for approval
    const project = await this.prisma.project.findUnique({
      where: { id: run.projectId },
      include: { createdBy: true }
    });

    if (!project) {
      throw new Error(`Project ${run.projectId} not found`);
    }

    // Create approval request
    const approvalType = (node.metadata as any)?.approvalType || node.taskType || 'workflow_approval';
    const requestData = {
      nodeId: node.id,
      workflowRunId: run.id,
      context: run.context,
      message: (node.metadata as any)?.message || 'Approval required to continue workflow execution',
      ...((node.metadata as any)?.requestData || {})
    };

    const approval = await this.prisma.approval.create({
      data: {
        workflowRunId: run.id,
        userId: project.createdById,
        approvalType,
        requestData: requestData as any,
        status: 'pending',
      },
    });

    // Emit approval required event (Req 9, Req 10)
    this.websocketGateway.sendToUser(project.createdById, {
      type: 'human:approval_required',
      data: {
        approvalId: approval.id,
        workflowRunId: run.id,
        projectId: run.projectId,
        approvalType,
        requestData,
        requestedAt: new Date()
      },
      timestamp: new Date()
    });

    this.logger.log(`Approval request ${approval.id} created and notification sent to user ${project.createdById}`);

    // Return pending_approval status to pause workflow
    return {
      status: 'pending_approval',
      output: {
        approvalId: approval.id,
        approvalType,
        requestData
      }
    };
  }

  /**
   * Execute a condition node - evaluates conditions from context
   * Implements Requirement 2: DAG-based workflow with conditional branching
   * Implements Requirement 9: WebSocket events for state changes
   */
  private async executeCondition(node: WorkflowNode, run: any): Promise<NodeResult> {
    this.logger.log(`Evaluating condition node ${node.id}`);

    // Simple condition evaluation (can be extended with a proper expression evaluator)
    const context = run.context as WorkflowContext;
    let conditionResult = false;

    try {
      // Example: Check if a variable in context meets condition
      // This is a simplified implementation - production should use a safe expression evaluator
      const variable = (node.metadata as any)?.variable;
      const operator = (node.metadata as any)?.operator;
      const value = (node.metadata as any)?.value;

      if (!variable || !operator) {
        throw new Error(`Condition node ${node.id} missing required metadata: variable, operator`);
      }

      const contextValue = context.variables[variable];
      
      this.logger.log(`Evaluating condition: ${variable} ${operator} ${value}, context value: ${contextValue}`);
      
      switch (operator) {
        case 'equals':
          conditionResult = contextValue === value;
          break;
        case 'not_equals':
          conditionResult = contextValue !== value;
          break;
        case 'greater_than':
          conditionResult = Number(contextValue) > Number(value);
          break;
        case 'less_than':
          conditionResult = Number(contextValue) < Number(value);
          break;
        case 'exists':
          conditionResult = contextValue !== undefined && contextValue !== null;
          break;
        case 'not_exists':
          conditionResult = contextValue === undefined || contextValue === null;
          break;
        default:
          throw new Error(`Unknown operator: ${operator}`);
      }

      this.logger.log(`Condition evaluated to: ${conditionResult}`);

      // Emit condition evaluation event (Req 9)
      this.websocketGateway.sendToProject(run.projectId, {
        type: 'workflow:state_changed',
        data: {
          workflowRunId: run.id,
          projectId: run.projectId,
          previousState: 'running',
          currentState: 'condition_evaluated',
          currentNodeId: node.id,
          timestamp: new Date()
        } as WorkflowStateChangedEvent,
        timestamp: new Date()
      });

      return {
        status: 'success',
        output: { 
          conditionResult, 
          edgeCondition: conditionResult ? 'onSuccess' : 'onFail',
          variable,
          operator,
          value,
          contextValue
        }
      };
    } catch (error) {
      this.logger.error(`Error evaluating condition for node ${node.id}: ${(error as Error).message}`);
      return { 
        status: 'failure', 
        error: (error as Error).message 
      };
    }
  }

  /**
   * Execute parallel nodes concurrently
   * Implements Requirement 2: Parallel node execution in workflow
   * Implements Requirement 9: WebSocket events for parallel execution
   * Implements Requirement 26: Performance optimization with parallel execution
   */
  private async executeParallel(node: WorkflowNode, run: any): Promise<NodeResult> {
    this.logger.log(`Executing parallel node ${node.id}`);

    const parallelNodeIds = (node.metadata as any)?.parallelNodes as string[];
    if (!parallelNodeIds || parallelNodeIds.length === 0) {
      throw new Error(`Parallel node ${node.id} missing parallelNodes in metadata`);
    }

    const def = this.definitions.get(run.workflowDefId);
    if (!def) throw new Error(`Workflow definition ${run.workflowDefId} not found`);

    const parallelNodes = parallelNodeIds
      .map(id => def.nodes.find(n => n.id === id))
      .filter(Boolean) as WorkflowNode[];

    if (parallelNodes.length === 0) {
      throw new Error(`No valid parallel nodes found for node ${node.id}`);
    }

    this.logger.log(`Executing ${parallelNodes.length} nodes in parallel: ${parallelNodeIds.join(', ')}`);

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
        this.logger.log(`Starting parallel execution of node ${parallelNode.id}`);
        return this.executeNode(parallelNode, run);
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

    this.logger.log(
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

  /**
   * Create a timeout promise
   */
  private createTimeoutPromise(ms: number, message: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms);
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
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
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
    const run = await this.prisma.workflowRun.findUnique({ where: { id: runId } });
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

      await this.transitionToNextNode(runId, edgeCondition);
      
      // Process next node by adding it to the queue
      await this.processCurrentNode(runId);
    } catch (error) {
      this.logger.error(`Error handling job completion for node ${nodeId}: ${(error as Error).message}`);
      await this.prisma.workflowRun.update({
        where: { id: runId },
        data: { status: 'failed', completedAt: new Date() }
      });
      
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

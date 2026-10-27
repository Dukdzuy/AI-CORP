import { WorkflowNode, NodeResult } from '@ai-corp/shared-types';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentOrchestratorService } from '../../orchestrator/agent-orchestrator.service';
import { Milestone } from '../../../domain/entities/Milestone';
import { Task } from '../../../domain/entities/Task';
import { TaskStatus } from '../../../domain/value-objects/TaskStatus';
import { Money } from '../../../domain/value-objects/Money';
import { IMilestoneRepository, ITaskRepository } from '../../../domain/repositories';
import { ITaskCostEstimator } from '../../../domain/estimation';
import { IWorkflowEngineRepository, WorkflowRunRecord } from '../persistence/workflow-engine.repository';
import { NodeExecutionStrategy, NodeExecutionContext } from './node-execution-strategy';

/**
 * Execute an agent task node
 * Implements Requirement 2: Workflow orchestration with agent task execution
 * Implements Requirement 9: WebSocket events for agent thinking and actions
 */
export class AgentTaskStrategy implements NodeExecutionStrategy {
  readonly type = 'agent_task' as const;

  constructor(
    private readonly repository: IWorkflowEngineRepository,
    private readonly websocketGateway: AppWebSocketGateway,
    private readonly orchestrator: AgentOrchestratorService,
    private readonly milestoneRepository: IMilestoneRepository,
    private readonly taskRepository: ITaskRepository,
    private readonly taskCostEstimator?: ITaskCostEstimator
  ) {}

  async execute(node: WorkflowNode, run: WorkflowRunRecord, ctx: NodeExecutionContext): Promise<NodeResult> {
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
      const metadata = (node.metadata || {}) as Record<string, unknown>;
      const agentInput: any = {
        projectId: run.projectId,
        taskId: node.id,
        task: (metadata.promptTemplate as string) || node.taskType || 'Please proceed with the assigned task.',
        taskType: node.taskType,
        workflowRunId: run.id,
        projectContext: workflowCtx,
        relevantMemories: [],
        availableTools: [],
        goal: workflowCtx.goal || '',
        milestone: workflowCtx.milestone || '',
        code: workflowCtx.code || '',
        projectSummary: workflowCtx.projectSummary || workflowCtx.goal || '',
        ...vars,
        // Set for turns of an agent_collaboration node: the pattern sends its own ACL messages
        collaboration: metadata.collaboration,
        // Node-level constraints, e.g. from template parameters (Task 19)
        ...(metadata.constraints ? { constraints: metadata.constraints } : {}),
      };
      const result = await this.orchestrator.invokeAgent(node.agentRole, agentInput);

      // Strategies return AgentActionResult { success, output: { action, output, ...fields } }
      const actionResult = result?.action;
      if (actionResult?.success === false) {
        throw new Error(actionResult.error || `Agent ${node.agentRole} reported failure`);
      }
      const payload = AgentTaskStrategy.unwrapActionOutput(actionResult);

      // Merge agent output back into workflow context variables
      // This allows condition nodes to check agent results (e.g., qa_approved) and later agents to read earlier output (e.g., code, qcReport)
      if (payload) {
        for (const [key, value] of Object.entries(payload)) {
          if (key !== 'action') {
            vars[key] = value;
          }
        }
        if (typeof payload.output === 'string' && payload.output) {
          // Auto-create milestones from CEO agent output
          if (payload.action === 'planMilestones') {
            await this.createMilestonesFromOutput(run.projectId, payload.output, ctx);
          }
          // Auto-create tasks from PM agent output
          if (payload.action === 'breakdownTasks') {
            await this.createTasksFromOutput(run.projectId, payload.output, ctx);
          }
        }
        workflowCtx.variables = vars;
        // Persist updated context to database
        await this.repository.updateRun(run.id, { context: workflowCtx as any });
      }

      // Wire agent actions to task updates (Task 32.2)
      await this.updateTaskStatusForAgent(node.agentRole, node.taskType, run.projectId, result, ctx);

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
      ctx.logger.error(`Agent task execution failed for node ${node.id}: ${(error as Error).message}`);
      return {
        status: 'failure',
        error: (error as Error).message
      };
    }
  }

  /**
   * The fields an agent produced: the strategy's output object, or a legacy { action, output } result
   */
  static unwrapActionOutput(action: any): Record<string, any> | null {
    if (!action || typeof action !== 'object') return null;
    if (typeof action.success === 'boolean') {
      return action.output && typeof action.output === 'object' ? action.output : { output: action.output };
    }
    return action;
  }

  /**
   * Create milestones from CEO agent output text
   */
  private async createMilestonesFromOutput(projectId: string, output: string, ctx: NodeExecutionContext): Promise<void> {
    try {
      // Parse bullet points or numbered items from CEO output
      const lines = output.split('\n').filter(l => l.trim().length > 0);
      const milestoneLines = lines.filter(l =>
        l.match(/^[\s]*[-*•]\s/) || l.match(/^[\s]*\d+[.)]\s/) || l.match(/^milestone/i)
      );

      if (milestoneLines.length === 0) {
        // Fallback: create a single milestone from the first meaningful line
        const firstMeaningful = lines.find(l => l.length > 10) || lines[0] || 'Project Planning';
        await this.addMilestone(
          projectId,
          firstMeaningful.replace(/^[\s]*[-*•]\s*/, '').replace(/^[\s]*\d+[.)]\s*/, '').trim().slice(0, 100),
          firstMeaningful.trim(),
        );
      } else {
        for (const line of milestoneLines.slice(0, 10)) {
          const name = line.replace(/^[\s]*[-*•]\s*/, '').replace(/^[\s]*\d+[.)]\s*/, '').replace(/^milestone[:\s]*/i, '').trim();
          if (name.length > 2) {
            await this.addMilestone(projectId, name.slice(0, 100), name);
          }
        }
      }
      ctx.logger.log(`Created milestones from CEO output for project ${projectId}`);
    } catch (error) {
      ctx.logger.warn(`Failed to create milestones from output: ${(error as Error).message}`);
    }
  }

  /**
   * Create tasks from PM agent output text
   */
  private async createTasksFromOutput(projectId: string, output: string, ctx: NodeExecutionContext): Promise<void> {
    try {
      const titles = AgentTaskStrategy.parseTaskTitles(output);
      // Phase 6, Task 25: each planned task carries its share of the forecast implementation cost
      const estimatedCost = this.taskCostEstimator ? await this.taskCostEstimator.estimateTaskCost(projectId, titles.length) : null;
      for (const title of titles) {
        await this.addTask(projectId, title.slice(0, 200), title, estimatedCost);
      }
      ctx.logger.log(`Created ${titles.length} tasks from PM output for project ${projectId}${estimatedCost !== null ? ` (estimated $${estimatedCost} each)` : ''}`);
    } catch (error) {
      ctx.logger.warn(`Failed to create tasks from output: ${(error as Error).message}`);
    }
  }

  /** Task titles in the PM's numbered or bulleted list; the first meaningful line when there is no list */
  static parseTaskTitles(output: string): string[] {
    const lines = output.split('\n').filter(l => l.trim().length > 0);
    const taskLines = lines.filter(l =>
      l.match(/^[\s]*[-*•]\s/) || l.match(/^[\s]*\d+[.)]\s/) || l.match(/^task/i)
    );
    if (taskLines.length === 0) {
      const firstMeaningful = lines.find(l => l.length > 5) || 'Implement feature';
      return [firstMeaningful.replace(/^[\s]*[-*•]\s*/, '').replace(/^[\s]*\d+[.)]\s*/, '').trim()];
    }
    return taskLines
      .slice(0, 20)
      .map(line => line.replace(/^[\s]*[-*•]\s*/, '').replace(/^[\s]*\d+[.)]\s*/, '').replace(/^task[:\s]*/i, '').trim())
      .filter(title => title.length > 2);
  }

  /**
   * Create an agent-planned milestone through the Milestone entity (starts pending)
   */
  private async addMilestone(projectId: string, name: string, description: string): Promise<void> {
    const state = Milestone.create({ projectId, name, description }).toPrimitives();
    await this.milestoneRepository.create({
      id: state.id,
      projectId: state.projectId,
      name: state.name,
      description: state.description,
      status: state.status,
      dueDate: state.dueDate,
    });
  }

  /**
   * Create an agent-planned task through the Task entity (starts in TODO)
   */
  private async addTask(projectId: string, title: string, description: string, estimatedCost: number | null = null): Promise<void> {
    const state = Task.create({ projectId, title, description, ...(estimatedCost !== null ? { estimatedCost: Money.dollars(estimatedCost) } : {}) }).toPrimitives();
    await this.taskRepository.create({
      id: state.id,
      projectId: state.projectId,
      title: state.title,
      description: state.description,
      status: state.status,
      priority: state.priority,
      estimatedCost: state.estimatedCost,
    });
  }

  /**
   * Update task status based on agent role after successful execution
   * Implements Task 32.2: Wire agent actions to task updates
   *
   * The DEV agent implements the whole approved design in one run, so:
   * - DEV done        → every todo / in_progress task moves to review
   * - QA approved     → every review task moves to done
   * - QA rejected     → review tasks go back to in_progress (the workflow loops back to DEV)
   * Moves go through the Task entity so the Kanban transition rules apply.
   * Other task types of these roles (DEV's plan in pair_develop) move nothing.
   */
  private async updateTaskStatusForAgent(agentRole: string, taskType: string | undefined, projectId: string, result: any, ctx: NodeExecutionContext): Promise<void> {
    try {
      if (agentRole === 'DEV' && (!taskType || taskType === 'implement')) {
        const tasks = [
          ...(await this.taskRepository.findByStatus(projectId, 'in_progress')),
          ...(await this.taskRepository.findByStatus(projectId, 'todo')),
        ];
        for (const task of tasks) {
          await this.moveTask(task, ['in_progress', 'review'], agentRole, projectId, ctx);
        }
        if (tasks.length === 0) {
          ctx.logger.log(`No open task found for project ${projectId}, skipping task status update`);
        }
      } else if (agentRole === 'QA' && (!taskType || taskType === 'review')) {
        const payload = AgentTaskStrategy.unwrapActionOutput(result?.action);
        const approved = payload?.qa_approved !== false;
        const tasks = await this.taskRepository.findByStatus(projectId, 'review');
        for (const task of tasks) {
          await this.moveTask(task, [approved ? 'done' : 'in_progress'], agentRole, projectId, ctx);
        }
      }
    } catch (error) {
      ctx.logger.error(`Failed to update task status for agent ${agentRole}: ${(error as Error).message}`);
    }
  }

  /** Walk a task through the given statuses (skipping the ones it is already in) and persist the result */
  private async moveTask(task: any, path: string[], agentRole: string, projectId: string, ctx: NodeExecutionContext): Promise<void> {
    const entity = Task.fromPrimitives(task);
    for (const status of path) {
      if (entity.toPrimitives().status !== status) {
        entity.transitionTo(TaskStatus.fromString(status));
      }
    }
    const newStatus = entity.toPrimitives().status;
    if (newStatus === task.status) return;

    await this.taskRepository.update(task.id, { status: newStatus });
    ctx.logger.log(`Updated task ${task.id} status to ${newStatus} after ${agentRole} agent completion`);

    // Emit WebSocket event for task status change
    this.websocketGateway.sendToProject(projectId, {
      type: 'task:updated',
      data: { taskId: task.id, status: newStatus, agentRole },
      timestamp: new Date(),
    });
  }
}

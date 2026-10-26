import { WorkflowNode, NodeResult } from '@ai-corp/shared-types';
import { AppWebSocketGateway } from '../../websocket/websocket.gateway';
import { AgentOrchestratorService } from '../../orchestrator/agent-orchestrator.service';
import { Milestone } from '../../../domain/entities/Milestone';
import { Task } from '../../../domain/entities/Task';
import { TaskStatus } from '../../../domain/value-objects/TaskStatus';
import { IMilestoneRepository, ITaskRepository } from '../../../domain/repositories';
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
    private readonly taskRepository: ITaskRepository
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

      // Merge agent output back into workflow context variables
      // This allows condition nodes to check agent results (e.g., qa_approved)
      if (result?.action) {
        const action = result.action;
        // Merge all output fields into variables
        if (action.output && typeof action.output === 'object') {
          Object.assign(vars, action.output);
        } else if (typeof action.output === 'string' && action.output) {
          // String output: store as 'output' key and also parse structured data
          vars.output = action.output;
          // Auto-create milestones from CEO agent output
          if (action.action === 'planMilestones') {
            await this.createMilestonesFromOutput(run.projectId, action.output, ctx);
          }
          // Auto-create tasks from PM agent output
          if (action.action === 'breakdownTasks') {
            await this.createTasksFromOutput(run.projectId, action.output, ctx);
          }
        }
        // Merge top-level action fields (like qa_approved, edgeCondition)
        for (const [key, value] of Object.entries(action)) {
          if (key !== 'output' && key !== 'action') {
            vars[key] = value;
          }
        }
        workflowCtx.variables = vars;
        // Persist updated context to database
        await this.repository.updateRun(run.id, { context: workflowCtx as any });
      }

      // Wire agent actions to task updates (Task 32.2)
      await this.updateTaskStatusForAgent(node.agentRole, run.projectId, result, ctx);

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
      // Parse task items from PM output
      const lines = output.split('\n').filter(l => l.trim().length > 0);
      const taskLines = lines.filter(l =>
        l.match(/^[\s]*[-*•]\s/) || l.match(/^[\s]*\d+[.)]\s/) || l.match(/^task/i)
      );

      if (taskLines.length === 0) {
        // Fallback: create a single task
        const firstMeaningful = lines.find(l => l.length > 5) || 'Implement feature';
        await this.addTask(
          projectId,
          firstMeaningful.replace(/^[\s]*[-*•]\s*/, '').replace(/^[\s]*\d+[.)]\s*/, '').trim().slice(0, 200),
          firstMeaningful.trim(),
        );
      } else {
        for (const line of taskLines.slice(0, 20)) {
          const title = line.replace(/^[\s]*[-*•]\s*/, '').replace(/^[\s]*\d+[.)]\s*/, '').replace(/^task[:\s]*/i, '').trim();
          if (title.length > 2) {
            await this.addTask(projectId, title.slice(0, 200), title);
          }
        }
      }
      ctx.logger.log(`Created tasks from PM output for project ${projectId}`);
    } catch (error) {
      ctx.logger.warn(`Failed to create tasks from output: ${(error as Error).message}`);
    }
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
  private async addTask(projectId: string, title: string, description: string): Promise<void> {
    const state = Task.create({ projectId, title, description }).toPrimitives();
    await this.taskRepository.create({
      id: state.id,
      projectId: state.projectId,
      title: state.title,
      description: state.description,
      status: state.status,
      priority: state.priority,
    });
  }

  /**
   * Update task status based on agent role after successful execution
   * Implements Task 32.2: Wire agent actions to task updates
   */
  private async updateTaskStatusForAgent(agentRole: string, projectId: string, result: any, ctx: NodeExecutionContext): Promise<void> {
    try {
      // Find the most recent task for this project that is in_progress (newest first)
      const [task] = await this.taskRepository.findByStatus(projectId, 'in_progress');

      if (!task) {
        ctx.logger.log(`No in_progress task found for project ${projectId}, skipping task status update`);
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
        // Move the task through the Task entity so Kanban transition rules apply
        const entity = Task.fromPrimitives(task);
        entity.transitionTo(TaskStatus.fromString(newStatus));
        await this.taskRepository.update(task.id, { status: entity.toPrimitives().status });
        ctx.logger.log(`Updated task ${task.id} status to ${newStatus} after ${agentRole} agent completion`);

        // Emit WebSocket event for task status change
        this.websocketGateway.sendToProject(projectId, {
          type: 'task:updated',
          data: { taskId: task.id, status: newStatus, agentRole },
          timestamp: new Date(),
        });
      }
    } catch (error) {
      ctx.logger.error(`Failed to update task status for agent ${agentRole}: ${(error as Error).message}`);
    }
  }
}

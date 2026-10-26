/**
 * TaskApplicationService - Application Service Layer for Tasks
 *
 * Orchestrates Task entity operations and raises domain events.
 * Separates business logic (in entity) from infrastructure concerns (event publishing).
 *
 * Responsibilities:
 * 1. Load task entities from repository
 * 2. Call entity business logic methods
 * 3. Detect state changes
 * 4. Raise appropriate domain events
 * 5. Persist task state back to repository
 *
 * This satisfies Single Responsibility Principle: entities contain business logic,
 * application service orchestrates the workflow.
 *
 * @pattern Application Service (DDD)
 * @principle Single Responsibility - separation of business logic from orchestration
 */

import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { WebSocketEventType } from '@ai-corp/shared-types';
import { ITaskRepository, TASK_REPOSITORY, TaskDTO } from '../../domain/repositories';
import { Task } from '../../domain/entities/Task';
import { EventBus } from '../../domain/events/EventBus';
import { TaskStatusChangedEvent } from '../../domain/events/TaskStatusChangedEvent';
import { TaskCompletedEvent } from '../../domain/events/TaskCompletedEvent';
import { Money, TaskStatus } from '../../domain/value-objects';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { CreateTaskDto, UpdateTaskDto } from './projects.dto';
import { applyDomainRule } from './domain-rule';

@Injectable()
export class TaskApplicationService {
  private readonly logger = new Logger(TaskApplicationService.name);

  constructor(
    @Inject(TASK_REPOSITORY) private readonly taskRepository: ITaskRepository,
    private readonly eventBus: EventBus,
    private readonly websocketGateway: AppWebSocketGateway,
  ) {}

  async listTasks(projectId?: string): Promise<TaskDTO[]> {
    return projectId ? this.taskRepository.findByProjectId(projectId) : this.taskRepository.findAll();
  }

  /**
   * Create a task through the Task entity factory (starts in TODO)
   */
  async createTask(projectId: string, data: CreateTaskDto): Promise<TaskDTO> {
    const task = applyDomainRule(() =>
      Task.create({
        projectId,
        milestoneId: data.milestoneId,
        title: data.title,
        description: data.description,
        priority: data.priority,
        assignedAgent: data.assignedAgent,
      })
    );

    const state = task.toPrimitives();
    const dto = await this.taskRepository.create({
      id: state.id,
      projectId: state.projectId,
      milestoneId: state.milestoneId,
      title: state.title,
      description: state.description,
      status: state.status,
      priority: state.priority,
      assignedAgent: state.assignedAgent,
      estimatedCost: state.estimatedCost,
    });

    this.logger.log(`Created task ${dto.id} for project ${projectId}`);
    this.emitTaskUpdated(dto);
    return dto;
  }

  /**
   * Update details and/or move the task on the Kanban board
   */
  async updateTask(taskId: string, data: UpdateTaskDto): Promise<TaskDTO> {
    return this.change(taskId, task => {
      task.updateDetails(data.title, data.description);
      if (data.priority !== undefined) task.updatePriority(data.priority);
      if (data.assignedAgent !== undefined) task.assignTo(data.assignedAgent);
      if (data.status !== undefined) task.transitionTo(TaskStatus.fromString(data.status));
    });
  }

  /**
   * Start task progress (TODO -> IN_PROGRESS)
   */
  async startProgress(taskId: string): Promise<TaskDTO> {
    return this.change(taskId, task => task.startProgress());
  }

  /**
   * Submit task for review (IN_PROGRESS -> REVIEW)
   */
  async submitForReview(taskId: string): Promise<TaskDTO> {
    return this.change(taskId, task => task.submitForReview());
  }

  /**
   * Approve task (REVIEW -> DONE)
   * Business rule: can only approve if in REVIEW status
   */
  async approveTask(taskId: string): Promise<TaskDTO> {
    return this.change(taskId, task => task.approve());
  }

  /**
   * Reject task with reason (REVIEW -> IN_PROGRESS for rework)
   */
  async rejectTask(taskId: string, reason: string): Promise<TaskDTO> {
    return this.change(taskId, task => task.reject(reason));
  }

  /**
   * Complete task directly (edge case: TODO -> DONE)
   */
  async completeTask(taskId: string, agentRole?: string): Promise<TaskDTO> {
    return this.change(taskId, task => task.complete(), agentRole);
  }

  /**
   * Move task back to backlog (IN_PROGRESS -> TODO)
   */
  async moveBackToBacklog(taskId: string): Promise<TaskDTO> {
    return this.change(taskId, task => task.moveBackToBacklog());
  }

  /**
   * Accrue cost to task
   */
  async accrueCost(taskId: string, costAmount: number): Promise<TaskDTO> {
    return this.change(taskId, task => task.accrueCost(Money.dollars(costAmount)));
  }

  /**
   * Load -> apply entity logic -> persist -> raise events for any status change
   */
  private async change(taskId: string, operation: (task: Task) => void, agentRole?: string): Promise<TaskDTO> {
    const task = await this.load(taskId);
    const oldStatus = task.getStatus().toString();

    applyDomainRule(() => operation(task)); // Entity enforces transition rules

    const dto = await this.persist(task);
    const newStatus = task.getStatus().toString();

    if (newStatus !== oldStatus) {
      await this.eventBus.publish(
        new TaskStatusChangedEvent(taskId, task.getProjectId(), oldStatus, newStatus)
      ).catch(err => this.logger.error(`Failed to publish TaskStatusChangedEvent: ${err.message}`));

      if (task.getStatus().isComplete()) {
        await this.eventBus.publish(
          new TaskCompletedEvent(
            taskId,
            task.getProjectId(),
            agentRole ?? task.getAssignedAgent() ?? 'unassigned',
            task.getTitle()
          )
        ).catch(err => this.logger.error(`Failed to publish TaskCompletedEvent: ${err.message}`));
      }
    }

    this.logger.log(`Updated task ${taskId}`);
    this.emitTaskUpdated(dto);
    return dto;
  }

  private async load(taskId: string): Promise<Task> {
    const dto = await this.taskRepository.findById(taskId);
    if (!dto) {
      throw new NotFoundException(`Task with ID ${taskId} not found.`);
    }
    return Task.fromPrimitives(dto);
  }

  private async persist(task: Task): Promise<TaskDTO> {
    const state = task.toPrimitives();
    return this.taskRepository.update(state.id, {
      milestoneId: state.milestoneId,
      title: state.title,
      description: state.description,
      status: state.status,
      priority: state.priority,
      assignedAgent: state.assignedAgent,
      estimatedCost: state.estimatedCost,
      actualCost: state.actualCost,
    });
  }

  private emitTaskUpdated(task: TaskDTO) {
    this.websocketGateway.sendToProject(task.projectId, {
      type: WebSocketEventType.TASK_UPDATED,
      data: task,
      timestamp: new Date()
    } as any);
  }
}

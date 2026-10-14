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

import { Injectable, Inject, Logger } from '@nestjs/common';
import { ITaskRepository, TASK_REPOSITORY } from '../../domain/repositories';
import { Task } from '../../domain/entities/Task';
import { EventBus } from '../../domain/events/EventBus';
import { TaskStatusChangedEvent } from '../../domain/events/TaskStatusChangedEvent';
import { TaskCompletedEvent } from '../../domain/events/TaskCompletedEvent';
import { Money } from '../../domain/value-objects';

@Injectable()
export class TaskApplicationService {
  private readonly logger = new Logger(TaskApplicationService.name);

  constructor(
    @Inject(TASK_REPOSITORY) private readonly taskRepository: ITaskRepository,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Start task progress (TODO -> IN_PROGRESS)
   */
  async startProgress(taskId: string): Promise<void> {
    const dto = await this.taskRepository.findById(taskId);
    if (!dto) {
      throw new Error(`Task with id '${taskId}' not found`);
    }

    const task = Task.fromPrimitives(dto);
    const oldStatus = task.getStatus().toString();
    
    task.startProgress(); // Entity enforces transition rules

    await this.taskRepository.updateStatus(taskId, task.getStatus().toString());

    // Raise TaskStatusChangedEvent
    await this.eventBus.publish(
      new TaskStatusChangedEvent(taskId, oldStatus, task.getStatus().toString())
    ).catch(err => this.logger.error(`Failed to publish TaskStatusChangedEvent: ${err.message}`));
  }

  /**
   * Submit task for review (IN_PROGRESS -> REVIEW)
   */
  async submitForReview(taskId: string): Promise<void> {
    const dto = await this.taskRepository.findById(taskId);
    if (!dto) {
      throw new Error(`Task with id '${taskId}' not found`);
    }

    const task = Task.fromPrimitives(dto);
    const oldStatus = task.getStatus().toString();
    
    task.submitForReview();

    await this.taskRepository.updateStatus(taskId, task.getStatus().toString());

    await this.eventBus.publish(
      new TaskStatusChangedEvent(taskId, oldStatus, task.getStatus().toString())
    ).catch(err => this.logger.error(`Failed to publish TaskStatusChangedEvent: ${err.message}`));
  }

  /**
   * Approve task (REVIEW -> DONE)
   * Business rule: can only approve if in REVIEW status
   */
  async approveTask(taskId: string): Promise<void> {
    const dto = await this.taskRepository.findById(taskId);
    if (!dto) {
      throw new Error(`Task with id '${taskId}' not found`);
    }

    const task = Task.fromPrimitives(dto);
    const oldStatus = task.getStatus().toString();
    
    task.approve(); // Entity enforces "only approve if in REVIEW" rule

    await this.taskRepository.updateStatus(taskId, task.getStatus().toString());

    // Raise both TaskStatusChangedEvent and TaskCompletedEvent
    await this.eventBus.publish(
      new TaskStatusChangedEvent(taskId, oldStatus, task.getStatus().toString())
    ).catch(err => this.logger.error(`Failed to publish TaskStatusChangedEvent: ${err.message}`));

    await this.eventBus.publish(
      new TaskCompletedEvent(taskId, task.getProjectId(), task.getAssignedAgent())
    ).catch(err => this.logger.error(`Failed to publish TaskCompletedEvent: ${err.message}`));
  }

  /**
   * Reject task with reason (REVIEW -> IN_PROGRESS for rework)
   * Business rule: rejection moves back to in_progress
   */
  async rejectTask(taskId: string, reason: string): Promise<void> {
    const dto = await this.taskRepository.findById(taskId);
    if (!dto) {
      throw new Error(`Task with id '${taskId}' not found`);
    }

    const task = Task.fromPrimitives(dto);
    const oldStatus = task.getStatus().toString();
    
    task.reject(reason); // Entity enforces rejection rules

    await this.taskRepository.updateStatus(taskId, task.getStatus().toString());

    await this.eventBus.publish(
      new TaskStatusChangedEvent(taskId, oldStatus, task.getStatus().toString())
    ).catch(err => this.logger.error(`Failed to publish TaskStatusChangedEvent: ${err.message}`));
  }

  /**
   * Complete task directly (edge case: TODO -> DONE or IN_PROGRESS -> DONE)
   */
  async completeTask(taskId: string, agentId?: string): Promise<void> {
    const dto = await this.taskRepository.findById(taskId);
    if (!dto) {
      throw new Error(`Task with id '${taskId}' not found`);
    }

    const task = Task.fromPrimitives(dto);
    const oldStatus = task.getStatus().toString();
    
    task.complete();

    await this.taskRepository.updateStatus(taskId, task.getStatus().toString());

    await this.eventBus.publish(
      new TaskStatusChangedEvent(taskId, oldStatus, task.getStatus().toString())
    ).catch(err => this.logger.error(`Failed to publish TaskStatusChangedEvent: ${err.message}`));

    await this.eventBus.publish(
      new TaskCompletedEvent(taskId, task.getProjectId(), agentId ?? task.getAssignedAgent())
    ).catch(err => this.logger.error(`Failed to publish TaskCompletedEvent: ${err.message}`));
  }

  /**
   * Move task back to backlog (IN_PROGRESS -> TODO)
   */
  async moveBackToBacklog(taskId: string): Promise<void> {
    const dto = await this.taskRepository.findById(taskId);
    if (!dto) {
      throw new Error(`Task with id '${taskId}' not found`);
    }

    const task = Task.fromPrimitives(dto);
    const oldStatus = task.getStatus().toString();
    
    task.moveBackToBacklog();

    await this.taskRepository.updateStatus(taskId, task.getStatus().toString());

    await this.eventBus.publish(
      new TaskStatusChangedEvent(taskId, oldStatus, task.getStatus().toString())
    ).catch(err => this.logger.error(`Failed to publish TaskStatusChangedEvent: ${err.message}`));
  }

  /**
   * Accrue cost to task
   */
  async accrueCost(taskId: string, costAmount: number): Promise<void> {
    const dto = await this.taskRepository.findById(taskId);
    if (!dto) {
      throw new Error(`Task with id '${taskId}' not found`);
    }

    const task = Task.fromPrimitives(dto);
    
    task.accrueCost(Money.dollars(costAmount));

    // Update task with new cost
    await this.taskRepository.updateStatus(taskId, task.getStatus().toString());
  }
}

/**
 * Task Domain Entity
 * 
 * Rich domain entity encapsulating task business logic.
 * Based on Prisma schema fields:
 * - id, projectId, milestoneId, title, description
 * - status, priority, assignedAgent
 * - estimatedCost, actualCost, createdAt, updatedAt
 * 
 * Business Rules (Requirement 12):
 * 1. Title must not be empty
 * 2. Status transitions follow Kanban rules:
 *    - todo -> in_progress, done
 *    - in_progress -> review, todo
 *    - review -> done, in_progress
 *    - done -> terminal state
 * 3. Can only approve if in REVIEW status
 * 4. Can reject with reason, moves back to in_progress
 * 5. Cost tracking with estimatedCost vs actualCost
 * 
 * Domain Events (commented for Task 10):
 * - TaskCreated, TaskStatusChanged, TaskCompleted
 * 
 * TODO (DDD Aggregate Boundary - Issue 12):
 * - Current design: Task is a separate aggregate root with its own repository
 * - Recommended: Task should be part of the Project aggregate
 * - Rationale: Tasks cannot exist without a Project; they are existentially dependent
 * - Impact: Task lifecycle and consistency should be managed through Project aggregate
 * - Refactoring: Move Task creation/modification to Project.addTask(), Project.updateTask()
 * - Repository: Remove TaskRepository, access tasks only through ProjectRepository
 * - Benefits: True transactional consistency, enforces invariants across Project + Tasks
 * 
 * @pattern Domain Entity (DDD), State Pattern
 * @principle Kanban Workflow Rules
 */

import { randomUUID } from 'crypto';
import { Money, TaskStatus, AgentRole } from '../value-objects';

export interface CreateTaskProps {
  projectId: string;
  milestoneId?: string | null;
  title: string;
  description: string;
  priority?: 'low' | 'medium' | 'high';
  assignedAgent?: string | null;
  estimatedCost?: Money;
}

export class Task {
  private constructor(
    private readonly id: string,
    private readonly projectId: string,
    private milestoneId: string | null,
    private title: string,
    private description: string,
    private status: TaskStatus,
    private priority: 'low' | 'medium' | 'high',
    private assignedAgent: string | null,
    private estimatedCost: Money | null,
    private actualCost: Money,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  // Factory method
  static create(props: CreateTaskProps): Task {
    // Validation
    if (!props.title || props.title.trim().length === 0) {
      throw new Error('Task title must not be empty');
    }

    const task = new Task(
      randomUUID(),
      props.projectId,
      props.milestoneId ?? null,
      props.title.trim(),
      props.description?.trim() || '',
      TaskStatus.TODO,
      props.priority || 'medium',
      props.assignedAgent ?? null,
      props.estimatedCost || null,
      Money.zero(),
      new Date(),
      new Date()
    );

    // Task 10 will wire domain events here
    // DomainEvents.raise(new TaskCreatedEvent(task.getId(), task.getProjectId()));

    return task;
  }

  // Reconstitute from database
  static fromPrimitives(data: {
    id: string;
    projectId: string;
    milestoneId: string | null;
    title: string;
    description: string;
    status: string;
    priority: string;
    assignedAgent: string | null;
    estimatedCost: number | null;
    actualCost: number;
    createdAt: Date;
    updatedAt: Date;
  }): Task {
    return new Task(
      data.id,
      data.projectId,
      data.milestoneId,
      data.title,
      data.description,
      TaskStatus.fromString(data.status),
      data.priority as 'low' | 'medium' | 'high',
      data.assignedAgent,
      data.estimatedCost !== null ? Money.dollars(data.estimatedCost) : null,
      Money.dollars(data.actualCost),
      data.createdAt,
      data.updatedAt
    );
  }

  // Map to database format
  toPrimitives(): {
    id: string;
    projectId: string;
    milestoneId: string | null;
    title: string;
    description: string;
    status: string;
    priority: string;
    assignedAgent: string | null;
    estimatedCost: number | null;
    actualCost: number;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      projectId: this.projectId,
      milestoneId: this.milestoneId,
      title: this.title,
      description: this.description,
      status: this.status.toString(),
      priority: this.priority,
      assignedAgent: this.assignedAgent,
      estimatedCost: this.estimatedCost?.toNumber() ?? null,
      actualCost: this.actualCost.toNumber(),
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // State transition methods (Kanban workflow)
  startProgress(): void {
    if (!this.status.canTransitionTo(TaskStatus.IN_PROGRESS)) {
      throw new Error(`Cannot transition from ${this.status.toString()} to in_progress`);
    }
    const oldStatus = this.status;
    this.status = TaskStatus.IN_PROGRESS;
    this.updatedAt = new Date();

    // Task 10 will wire domain events here
    // DomainEvents.raise(new TaskStatusChangedEvent(this.id, oldStatus.toString(), this.status.toString()));
  }

  submitForReview(): void {
    if (!this.status.canTransitionTo(TaskStatus.REVIEW)) {
      throw new Error(`Cannot transition from ${this.status.toString()} to review`);
    }
    const oldStatus = this.status;
    this.status = TaskStatus.REVIEW;
    this.updatedAt = new Date();

    // Task 10 will wire domain events here
    // DomainEvents.raise(new TaskStatusChangedEvent(this.id, oldStatus.toString(), this.status.toString()));
  }

  approve(): void {
    // Business rule: can only approve if in REVIEW status
    if (!this.status.requiresReview()) {
      throw new Error('Can only approve tasks in review status');
    }
    if (!this.status.canTransitionTo(TaskStatus.DONE)) {
      throw new Error(`Cannot transition from ${this.status.toString()} to done`);
    }
    const oldStatus = this.status;
    this.status = TaskStatus.DONE;
    this.updatedAt = new Date();

    // Task 10 will wire domain events here
    // DomainEvents.raise(new TaskCompletedEvent(this.id, this.projectId));
  }

  reject(reason: string): void {
    // Business rule: rejection moves back to in_progress for rework
    if (!this.status.requiresReview()) {
      throw new Error('Can only reject tasks in review status');
    }
    if (!this.status.canTransitionTo(TaskStatus.IN_PROGRESS)) {
      throw new Error(`Cannot transition from ${this.status.toString()} to in_progress`);
    }
    const oldStatus = this.status;
    this.status = TaskStatus.IN_PROGRESS;
    this.updatedAt = new Date();

    // Task 10 will wire domain events here
    // DomainEvents.raise(new TaskRejectedEvent(this.id, reason));
  }

  complete(): void {
    // Direct completion from TODO (edge case)
    if (!this.status.canTransitionTo(TaskStatus.DONE)) {
      throw new Error(`Cannot transition from ${this.status.toString()} to done`);
    }
    const oldStatus = this.status;
    this.status = TaskStatus.DONE;
    this.updatedAt = new Date();

    // Task 10 will wire domain events here
    // DomainEvents.raise(new TaskCompletedEvent(this.id, this.projectId));
  }

  moveBackToBacklog(): void {
    // Move from in_progress back to todo
    if (!this.status.canTransitionTo(TaskStatus.TODO)) {
      throw new Error(`Cannot transition from ${this.status.toString()} to todo`);
    }
    const oldStatus = this.status;
    this.status = TaskStatus.TODO;
    this.updatedAt = new Date();

    // Task 10 will wire domain events here
    // DomainEvents.raise(new TaskStatusChangedEvent(this.id, oldStatus.toString(), this.status.toString()));
  }

  /**
   * Generic Kanban move (e.g. a board drag-and-drop to a target column).
   * Delegates to the intention-revealing transition so every rule above still applies.
   */
  transitionTo(target: TaskStatus, reason: string = 'Changes requested'): void {
    if (this.status.equals(target)) return;

    if (target.equals(TaskStatus.IN_PROGRESS)) {
      return this.status.requiresReview() ? this.reject(reason) : this.startProgress();
    }
    if (target.equals(TaskStatus.REVIEW)) return this.submitForReview();
    if (target.equals(TaskStatus.TODO)) return this.moveBackToBacklog();
    return this.status.requiresReview() ? this.approve() : this.complete();
  }

  // Business logic - cost tracking
  accrueCost(cost: Money): void {
    if (cost.lessThan(Money.zero())) {
      throw new Error('Cannot accrue negative cost');
    }
    this.actualCost = this.actualCost.add(cost);
    this.updatedAt = new Date();
  }

  isOverEstimate(): boolean {
    if (!this.estimatedCost) return false;
    return this.actualCost.greaterThan(this.estimatedCost);
  }

  /**
   * Actual minus estimated cost in dollars: positive when over the estimate, negative under it.
   * A plain number, because Money cannot be negative (it used to throw for every task under
   * its estimate; found by the Phase 6 domain tests).
   */
  getCostVariance(): number | null {
    if (!this.estimatedCost) return null;
    return Math.round((this.actualCost.toNumber() - this.estimatedCost.toNumber()) * 1e6) / 1e6;
  }

  // Update methods
  updateDetails(title?: string, description?: string): void {
    if (title !== undefined) {
      if (title.trim().length === 0) {
        throw new Error('Task title must not be empty');
      }
      this.title = title.trim();
    }
    if (description !== undefined) {
      this.description = description.trim();
    }
    this.updatedAt = new Date();
  }

  assignTo(agentRole: string | null): void {
    this.assignedAgent = agentRole;
    this.updatedAt = new Date();
  }

  updatePriority(priority: 'low' | 'medium' | 'high'): void {
    this.priority = priority;
    this.updatedAt = new Date();
  }

  updateEstimate(estimatedCost: Money | null): void {
    this.estimatedCost = estimatedCost;
    this.updatedAt = new Date();
  }

  associateWithMilestone(milestoneId: string | null): void {
    this.milestoneId = milestoneId;
    this.updatedAt = new Date();
  }

  // Getters
  getId(): string { return this.id; }
  getProjectId(): string { return this.projectId; }
  getMilestoneId(): string | null { return this.milestoneId; }
  getTitle(): string { return this.title; }
  getDescription(): string { return this.description; }
  getStatus(): TaskStatus { return this.status; }
  getPriority(): 'low' | 'medium' | 'high' { return this.priority; }
  getAssignedAgent(): string | null { return this.assignedAgent; }
  getEstimatedCost(): Money | null { return this.estimatedCost; }
  getActualCost(): Money { return this.actualCost; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }
}

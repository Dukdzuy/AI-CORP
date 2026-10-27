/**
 * Milestone Domain Entity
 * 
 * Rich domain entity encapsulating milestone business logic.
 * Based on Prisma schema fields:
 * - id, projectId, name, description, status, dueDate
 * - createdAt, updatedAt
 * 
 * Business Rules:
 * 1. Name must not be empty
 * 2. Status transitions: pending -> in_progress -> completed
 * 3. Due date must be in the future when set
 * 4. Cannot complete if overdue without explicit override
 * 
 * Domain Events (commented for Task 10):
 * - MilestoneCreated, MilestoneCompleted, MilestoneOverdue
 * 
 * TODO (DDD Aggregate Boundary - Issue 12):
 * - Current design: Milestone is a separate aggregate root with its own repository
 * - Recommended: Milestone should be part of the Project aggregate
 * - Rationale: Milestones cannot exist without a Project; they define Project structure
 * - Impact: Milestone lifecycle should be managed through Project aggregate
 * - Refactoring: Move Milestone creation/modification to Project.addMilestone(), Project.updateMilestone()
 * - Repository: Remove MilestoneRepository, access milestones only through ProjectRepository
 * - Benefits: Enforces consistency between Project and its Milestones in a single transaction
 * 
 * @pattern Domain Entity (DDD)
 * @principle Business Rule Encapsulation
 */

import { randomUUID } from 'crypto';

export interface CreateMilestoneProps {
  projectId: string;
  name: string;
  description: string;
  dueDate?: Date | null;
}

export class Milestone {
  private constructor(
    private readonly id: string,
    private readonly projectId: string,
    private name: string,
    private description: string,
    private status: 'pending' | 'in_progress' | 'completed',
    private dueDate: Date | null,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  // Factory method
  static create(props: CreateMilestoneProps): Milestone {
    // Validation
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Milestone name must not be empty');
    }

    // Business rule: due date must be in the future
    if (props.dueDate && props.dueDate <= new Date()) {
      throw new Error('Due date must be in the future');
    }

    const milestone = new Milestone(
      randomUUID(),
      props.projectId,
      props.name.trim(),
      props.description?.trim() || '',
      'pending',
      props.dueDate ?? null,
      new Date(),
      new Date()
    );

    // Task 10 will wire domain events here
    // DomainEvents.raise(new MilestoneCreatedEvent(milestone.getId(), milestone.getProjectId()));

    return milestone;
  }

  // Reconstitute from database
  static fromPrimitives(data: {
    id: string;
    projectId: string;
    name: string;
    description: string;
    status: string;
    dueDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): Milestone {
    return new Milestone(
      data.id,
      data.projectId,
      data.name,
      data.description,
      data.status as 'pending' | 'in_progress' | 'completed',
      data.dueDate,
      data.createdAt,
      data.updatedAt
    );
  }

  // Map to database format
  toPrimitives(): {
    id: string;
    projectId: string;
    name: string;
    description: string;
    status: string;
    dueDate: Date | null;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      projectId: this.projectId,
      name: this.name,
      description: this.description,
      status: this.status,
      dueDate: this.dueDate,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // State transition methods
  start(): void {
    if (this.status !== 'pending') {
      throw new Error('Can only start pending milestones');
    }
    this.status = 'in_progress';
    this.updatedAt = new Date();
  }

  complete(overrideOverdue: boolean = false): void {
    if (this.status === 'completed') {
      throw new Error('Milestone is already completed');
    }

    // Business rule: cannot complete overdue milestone without override
    if (!overrideOverdue && this.isOverdue()) {
      throw new Error('Cannot complete overdue milestone. Use overrideOverdue flag if intentional.');
    }

    this.status = 'completed';
    this.updatedAt = new Date();

    // Task 10 will wire domain events here
    // DomainEvents.raise(new MilestoneCompletedEvent(this.id, this.projectId));
  }

  moveBackToPending(): void {
    if (this.status === 'completed') {
      throw new Error('Cannot move completed milestone back to pending');
    }
    this.status = 'pending';
    this.updatedAt = new Date();
  }

  /**
   * Move to a target status, delegating to the intention-revealing transition
   */
  transitionTo(target: string, overrideOverdue: boolean = false): void {
    if (this.status === target) return;

    switch (target) {
      case 'in_progress':
        return this.start();
      case 'completed':
        return this.complete(overrideOverdue);
      case 'pending':
        return this.moveBackToPending();
      default:
        throw new Error(`Invalid milestone status: '${target}'. Valid values: pending, in_progress, completed`);
    }
  }

  // Business logic
  isOverdue(): boolean {
    if (!this.dueDate || this.status === 'completed') {
      return false;
    }
    return new Date() > this.dueDate;
  }

  getDaysUntilDue(): number | null {
    if (!this.dueDate) return null;
    const now = new Date();
    const diffMs = this.dueDate.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  isAtRisk(): boolean {
    const daysUntilDue = this.getDaysUntilDue();
    if (daysUntilDue === null) return false;
    // At risk if less than 7 days remaining and not completed
    return daysUntilDue <= 7 && this.status !== 'completed';
  }

  // Update methods
  updateDetails(name?: string, description?: string): void {
    if (name !== undefined) {
      if (name.trim().length === 0) {
        throw new Error('Milestone name must not be empty');
      }
      this.name = name.trim();
    }
    if (description !== undefined) {
      this.description = description.trim();
    }
    this.updatedAt = new Date();
  }

  updateDueDate(dueDate: Date | null): void {
    // Business rule: due date must be in the future
    if (dueDate && dueDate <= new Date()) {
      throw new Error('Due date must be in the future');
    }
    this.dueDate = dueDate;
    this.updatedAt = new Date();
  }

  // Getters
  getId(): string { return this.id; }
  getProjectId(): string { return this.projectId; }
  getName(): string { return this.name; }
  getDescription(): string { return this.description; }
  getStatus(): 'pending' | 'in_progress' | 'completed' { return this.status; }
  getDueDate(): Date | null { return this.dueDate; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }
}

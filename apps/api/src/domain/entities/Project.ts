/**
 * Project Domain Entity
 * 
 * Rich domain entity encapsulating project business logic.
 * Based on Prisma schema fields:
 * - id, name, description, goal, status, budget, costAccrued
 * - createdById, createdAt, updatedAt
 * 
 * Business Rules:
 * 1. Name must be at least 3 characters (validation)
 * 2. Goal must be at least 20 characters (validation)
 * 3. Budget must be positive when provided (validation)
 * 4. Auto-pause when cost exceeds budget (Requirement 17.2)
 * 5. Warn at 90% budget threshold
 * 6. Cannot pause/cancel completed projects
 * 
 * Domain Events (commented for Task 10):
 * - ProjectCreated, BudgetExceeded, BudgetWarning
 * 
 * @pattern Domain Entity (DDD), Factory Pattern
 * @principle Rich Domain Model, Encapsulation
 */

import { randomUUID } from 'crypto';
import { Money, ProjectStatus } from '../value-objects';

export interface CreateProjectProps {
  name: string;
  description: string;
  goal: string;
  budget?: Money;
  createdById: string;
}

export class Project {
  private constructor(
    private readonly id: string,
    private name: string,
    private description: string,
    private goal: string,
    private status: ProjectStatus,
    private budget: Money | null,
    private costAccrued: Money,
    private readonly createdById: string,
    private readonly createdAt: Date,
    private updatedAt: Date
  ) {}

  // Factory method - enforces business rules at creation
  static create(props: CreateProjectProps): Project {
    // Validation rules
    if (!props.name || props.name.trim().length < 3) {
      throw new Error('Project name must be at least 3 characters');
    }
    if (!props.goal || props.goal.trim().length < 20) {
      throw new Error('Project goal must be at least 20 characters');
    }
    if (props.budget && props.budget.lessThanOrEqual(Money.zero())) {
      throw new Error('Budget must be positive when provided');
    }

    const project = new Project(
      randomUUID(), // Generate ID
      props.name.trim(),
      props.description?.trim() || '',
      props.goal.trim(),
      ProjectStatus.ACTIVE,
      props.budget || null,
      Money.zero(),
      props.createdById,
      new Date(),
      new Date()
    );

    // Task 10 will wire domain events here
    // DomainEvents.raise(new ProjectCreatedEvent(project.getId()));

    return project;
  }

  // Reconstitute from database
  static fromPrimitives(data: {
    id: string;
    name: string;
    description: string;
    goal: string;
    status: string;
    budget: number | null;
    costAccrued: number;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
  }): Project {
    return new Project(
      data.id,
      data.name,
      data.description,
      data.goal,
      ProjectStatus.fromString(data.status),
      data.budget !== null ? Money.dollars(data.budget) : null,
      Money.dollars(data.costAccrued),
      data.createdById,
      data.createdAt,
      data.updatedAt
    );
  }

  // Map to database format (matches Prisma schema)
  toPrimitives(): {
    id: string;
    name: string;
    description: string;
    goal: string;
    status: string;
    budget: number | null;
    costAccrued: number;
    createdById: string;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      goal: this.goal,
      status: this.status.toString(),
      budget: this.budget?.toNumber() ?? null,
      costAccrued: this.costAccrued.toNumber(),
      createdById: this.createdById,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  // Business logic - accrue cost and check budget
  accrueCost(cost: Money): void {
    if (cost.lessThan(Money.zero())) {
      throw new Error('Cannot accrue negative cost');
    }

    this.costAccrued = this.costAccrued.add(cost);
    this.updatedAt = new Date();

    // Business rule: auto-pause when budget exceeded
    if (this.budget && this.costAccrued.greaterThanOrEqual(this.budget)) {
      if (this.status.isActive()) {
        this.status = ProjectStatus.PAUSED;
        // NOTE: Event-raising moved to Application Service layer (SRP - Single Responsibility Principle)
        // Application Service will detect this state change and raise BudgetExceededEvent
      }
    }
  }

  /**
   * Helper method for Application Service to detect budget exceeded state
   */
  isBudgetExceeded(): boolean {
    if (!this.budget) return false;
    return this.costAccrued.greaterThanOrEqual(this.budget);
  }

  isOverBudget(): boolean {
    if (!this.budget) return false;
    return this.costAccrued.greaterThan(this.budget);
  }

  getRemainingBudget(): Money | null {
    if (!this.budget) return null;
    if (this.isOverBudget()) return Money.zero();
    return this.budget.subtract(this.costAccrued);
  }

  getBudgetUtilizationPercent(): number | null {
    if (!this.budget || this.budget.equals(Money.zero())) return null;
    return (this.costAccrued.toNumber() / this.budget.toNumber()) * 100;
  }

  // State transition methods
  pause(): void {
    if (this.status.isTerminal()) {
      throw new Error(`Cannot pause ${this.status.toString()} project`);
    }
    if (!this.status.canTransitionTo(ProjectStatus.PAUSED)) {
      throw new Error(`Cannot transition from ${this.status.toString()} to paused`);
    }
    this.status = ProjectStatus.PAUSED;
    this.updatedAt = new Date();
  }

  resume(): void {
    if (!this.status.equals(ProjectStatus.PAUSED)) {
      throw new Error('Can only resume paused projects');
    }
    this.status = ProjectStatus.ACTIVE;
    this.updatedAt = new Date();
  }

  complete(): void {
    if (!this.status.canTransitionTo(ProjectStatus.COMPLETED)) {
      throw new Error(`Cannot transition from ${this.status.toString()} to completed`);
    }
    this.status = ProjectStatus.COMPLETED;
    this.updatedAt = new Date();
  }

  cancel(): void {
    if (!this.status.canTransitionTo(ProjectStatus.CANCELLED)) {
      throw new Error(`Cannot transition from ${this.status.toString()} to cancelled`);
    }
    this.status = ProjectStatus.CANCELLED;
    this.updatedAt = new Date();
  }

  /**
   * Move to a target status, delegating to the intention-revealing transition
   */
  transitionTo(target: ProjectStatus): void {
    if (this.status.equals(target)) return;

    if (target.equals(ProjectStatus.PAUSED)) return this.pause();
    if (target.equals(ProjectStatus.ACTIVE)) return this.resume();
    if (target.equals(ProjectStatus.COMPLETED)) return this.complete();
    return this.cancel();
  }

  // Update methods
  updateDetails(name?: string, description?: string, goal?: string): void {
    if (name !== undefined) {
      if (name.trim().length < 3) {
        throw new Error('Project name must be at least 3 characters');
      }
      this.name = name.trim();
    }
    if (description !== undefined) {
      this.description = description.trim();
    }
    if (goal !== undefined) {
      if (goal.trim().length < 20) {
        throw new Error('Project goal must be at least 20 characters');
      }
      this.goal = goal.trim();
    }
    this.updatedAt = new Date();
  }

  updateBudget(budget: Money | null): void {
    if (budget && budget.lessThanOrEqual(Money.zero())) {
      throw new Error('Budget must be positive when provided');
    }
    this.budget = budget;
    this.updatedAt = new Date();
  }

  // Getters
  getId(): string { return this.id; }
  getName(): string { return this.name; }
  getDescription(): string { return this.description; }
  getGoal(): string { return this.goal; }
  getStatus(): ProjectStatus { return this.status; }
  getBudget(): Money | null { return this.budget; }
  getCostAccrued(): Money { return this.costAccrued; }
  getCreatedById(): string { return this.createdById; }
  getCreatedAt(): Date { return this.createdAt; }
  getUpdatedAt(): Date { return this.updatedAt; }
}

/**
 * ProjectApplicationService - Application Service Layer
 * 
 * Orchestrates Project entity operations and raises domain events.
 * Follows the Application Service pattern: coordinate entities and infrastructure.
 * 
 * Responsibilities:
 * 1. Load entities from repository
 * 2. Call entity business logic methods
 * 3. Detect state changes
 * 4. Raise appropriate domain events
 * 5. Persist entity back to repository
 * 
 * This separates business logic (in Project entity) from event orchestration (here).
 * Satisfies Single Responsibility Principle - entities do business logic, service orchestrates.
 * 
 * @pattern Application Service (DDD)
 * @principle Single Responsibility - entities do business logic, service orchestrates
 */

import { Injectable, Inject, Logger } from '@nestjs/common';
import { IProjectRepository, PROJECT_REPOSITORY, CreateProjectData } from '../../domain/repositories';
import { Project } from '../../domain/entities/Project';
import { EventBus } from '../../domain/events/EventBus';
import { BudgetExceededEvent } from '../../domain/events/BudgetExceededEvent';
import { ProjectCreatedEvent } from '../../domain/events/ProjectCreatedEvent';
import { Money } from '../../domain/value-objects';

@Injectable()
export class ProjectApplicationService {
  private readonly logger = new Logger(ProjectApplicationService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projectRepository: IProjectRepository,
    private readonly eventBus: EventBus
  ) {}

  /**
   * Create a new project and raise ProjectCreatedEvent
   */
  async createProject(data: CreateProjectData): Promise<string> {
    // 1. Create entity using factory method (enforces validation)
    const project = Project.create({
      name: data.name,
      description: data.description,
      goal: data.goal,
      budget: data.budget !== undefined && data.budget !== null ? Money.dollars(data.budget) : undefined,
      createdById: data.createdById,
    });

    // 2. Persist to database (repository handles DTO conversion)
    const dto = await this.projectRepository.create({
      name: project.getName(),
      description: project.getDescription(),
      goal: project.getGoal(),
      budget: project.getBudget()?.toNumber() ?? null,
      createdById: project.getCreatedById(),
    });

    // 3. Raise domain event
    await this.eventBus.publish(
      new ProjectCreatedEvent(
        dto.id,
        dto.name,
        dto.createdById,
        dto.budget ?? undefined
      )
    ).catch(err => this.logger.error(`Failed to publish ProjectCreatedEvent: ${err.message}`));

    return dto.id;
  }

  /**
   * Accrue cost to project and raise BudgetExceededEvent if threshold crossed
   */
  async accrueCost(projectId: string, costAmount: number): Promise<void> {
    // 1. Load project DTO from repository
    const dto = await this.projectRepository.findById(projectId);
    if (!dto) {
      throw new Error(`Project with id '${projectId}' not found`);
    }

    // 2. Reconstitute domain entity
    const project = Project.fromPrimitives(dto);

    // 3. Record state before change
    const wasActive = project.getStatus().isActive();
    const budgetExceededBefore = project.isBudgetExceeded();

    // 4. Call entity business logic
    project.accrueCost(Money.dollars(costAmount));

    // 5. Detect if budget just exceeded (state change)
    const budgetExceededAfter = project.isBudgetExceeded();
    const budgetJustExceeded = !budgetExceededBefore && budgetExceededAfter && wasActive;

    // 6. Persist entity state
    await this.projectRepository.update(projectId, {
      costAccrued: project.getCostAccrued().toNumber(),
      status: project.getStatus().toString(),
    });

    // 7. Raise domain event if budget was exceeded
    if (budgetJustExceeded) {
      await this.eventBus.publish(
        new BudgetExceededEvent(
          projectId,
          project.getCostAccrued().toNumber(),
          project.getBudget()!.toNumber()
        )
      ).catch(err => this.logger.error(`Failed to publish BudgetExceededEvent: ${err.message}`));
    }
  }

  /**
   * Pause a project (business logic delegated to entity)
   */
  async pauseProject(projectId: string): Promise<void> {
    const dto = await this.projectRepository.findById(projectId);
    if (!dto) {
      throw new Error(`Project with id '${projectId}' not found`);
    }

    const project = Project.fromPrimitives(dto);
    project.pause(); // Entity enforces transition rules

    await this.projectRepository.update(projectId, {
      status: project.getStatus().toString(),
    });
  }

  /**
   * Resume a project
   */
  async resumeProject(projectId: string): Promise<void> {
    const dto = await this.projectRepository.findById(projectId);
    if (!dto) {
      throw new Error(`Project with id '${projectId}' not found`);
    }

    const project = Project.fromPrimitives(dto);
    project.resume();

    await this.projectRepository.update(projectId, {
      status: project.getStatus().toString(),
    });
  }

  /**
   * Complete a project
   */
  async completeProject(projectId: string): Promise<void> {
    const dto = await this.projectRepository.findById(projectId);
    if (!dto) {
      throw new Error(`Project with id '${projectId}' not found`);
    }

    const project = Project.fromPrimitives(dto);
    project.complete();

    await this.projectRepository.update(projectId, {
      status: project.getStatus().toString(),
    });
  }

  /**
   * Cancel a project
   */
  async cancelProject(projectId: string): Promise<void> {
    const dto = await this.projectRepository.findById(projectId);
    if (!dto) {
      throw new Error(`Project with id '${projectId}' not found`);
    }

    const project = Project.fromPrimitives(dto);
    project.cancel();

    await this.projectRepository.update(projectId, {
      status: project.getStatus().toString(),
    });
  }
}

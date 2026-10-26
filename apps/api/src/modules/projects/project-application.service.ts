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

import { Injectable, Inject, Logger, NotFoundException } from '@nestjs/common';
import { WorkflowContext } from '@ai-corp/shared-types';
import { IProjectRepository, PROJECT_REPOSITORY, ProjectDTO } from '../../domain/repositories';
import { Project } from '../../domain/entities/Project';
import { EventBus } from '../../domain/events/EventBus';
import { BudgetExceededEvent } from '../../domain/events/BudgetExceededEvent';
import { ProjectCreatedEvent } from '../../domain/events/ProjectCreatedEvent';
import { Money, ProjectStatus } from '../../domain/value-objects';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { WorkflowDefinitionService } from '../workflow/workflow-definition.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';
import { applyDomainRule } from './domain-rule';

@Injectable()
export class ProjectApplicationService {
  private readonly logger = new Logger(ProjectApplicationService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projectRepository: IProjectRepository,
    private readonly eventBus: EventBus,
    private readonly workflowEngine: WorkflowEngine,
    private readonly workflowDefinitionService: WorkflowDefinitionService,
  ) {}

  async listProjects(): Promise<ProjectDTO[]> {
    return this.projectRepository.findAll({ orderBy: 'createdAt', order: 'desc' });
  }

  /**
   * Create a new project, raise ProjectCreatedEvent and start its workflow
   */
  async createProject(data: CreateProjectDto & { createdById: string }): Promise<ProjectDTO> {
    // 1. Create entity using factory method (enforces validation)
    const project = applyDomainRule(() =>
      Project.create({
        name: data.name,
        description: data.description,
        goal: data.goal,
        budget: data.budget !== undefined && data.budget !== null ? Money.dollars(data.budget) : undefined,
        createdById: data.createdById,
      })
    );

    // 2. Persist the entity's state, including the identity it assigned
    const state = project.toPrimitives();
    const dto = await this.projectRepository.create({
      id: state.id,
      name: state.name,
      description: state.description,
      goal: state.goal,
      budget: state.budget,
      createdById: state.createdById,
    });
    this.logger.log(`Created project ${dto.id}`);

    // 3. Raise domain event
    await this.eventBus.publish(
      new ProjectCreatedEvent(
        dto.id,
        dto.name,
        dto.createdById,
        dto.budget ?? undefined
      )
    ).catch(err => this.logger.error(`Failed to publish ProjectCreatedEvent: ${err.message}`));

    // 4. Kick off the default agent workflow
    await this.startDefaultWorkflow(dto);

    return dto;
  }

  async getProjectDetails(id: string) {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    const projectWithMilestones = await this.projectRepository.findWithMilestones(id);
    const projectWithTasks = await this.projectRepository.findWithTasks(id);
    const projectWithWorkflows = await this.projectRepository.findWithWorkflowRuns(id, 10);

    return {
      ...project,
      milestones: projectWithMilestones?.milestones || [],
      tasks: projectWithTasks?.tasks || [],
      workflowRuns: projectWithWorkflows?.workflowRuns || [],
    };
  }

  /**
   * Update details, budget and/or status (all rules enforced by the entity)
   */
  async updateProject(id: string, data: UpdateProjectDto): Promise<ProjectDTO> {
    const project = await this.load(id);

    applyDomainRule(() => {
      project.updateDetails(data.name, data.description, data.goal);
      if (data.budget !== undefined) {
        project.updateBudget(data.budget !== null ? Money.dollars(data.budget) : null);
      }
      if (data.status !== undefined) {
        project.transitionTo(ProjectStatus.fromString(data.status));
      }
    });

    const dto = await this.persist(project);
    this.logger.log(`Updated project ${id}`);
    return dto;
  }

  async deleteProject(id: string) {
    await this.load(id);
    await this.projectRepository.delete(id);

    this.logger.log(`Deleted project ${id}`);
    return { success: true, id };
  }

  /**
   * Accrue cost to project and raise BudgetExceededEvent if threshold crossed
   */
  async accrueCost(projectId: string, costAmount: number): Promise<ProjectDTO> {
    const project = await this.load(projectId);

    // Record state before change
    const wasActive = project.getStatus().isActive();
    const budgetExceededBefore = project.isBudgetExceeded();

    // Entity business logic (auto-pauses when budget is exceeded)
    applyDomainRule(() => project.accrueCost(Money.dollars(costAmount)));

    // Detect if budget just exceeded (state change)
    const budgetJustExceeded = !budgetExceededBefore && project.isBudgetExceeded() && wasActive;

    const dto = await this.persist(project);

    if (budgetJustExceeded) {
      await this.eventBus.publish(
        new BudgetExceededEvent(
          projectId,
          project.getCostAccrued().toNumber(),
          project.getBudget()!.toNumber()
        )
      ).catch(err => this.logger.error(`Failed to publish BudgetExceededEvent: ${err.message}`));
    }

    return dto;
  }

  async pauseProject(projectId: string): Promise<ProjectDTO> {
    return this.transition(projectId, project => project.pause());
  }

  async resumeProject(projectId: string): Promise<ProjectDTO> {
    return this.transition(projectId, project => project.resume());
  }

  async completeProject(projectId: string): Promise<ProjectDTO> {
    return this.transition(projectId, project => project.complete());
  }

  async cancelProject(projectId: string): Promise<ProjectDTO> {
    return this.transition(projectId, project => project.cancel());
  }

  private async transition(projectId: string, change: (project: Project) => void): Promise<ProjectDTO> {
    const project = await this.load(projectId);
    applyDomainRule(() => change(project)); // Entity enforces transition rules
    return this.persist(project);
  }

  /**
   * Reconstitute the Project entity from the repository
   */
  private async load(id: string): Promise<Project> {
    const dto = await this.projectRepository.findById(id);
    if (!dto) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }
    return Project.fromPrimitives(dto);
  }

  /**
   * Write the entity's mutable state back through the repository
   */
  private async persist(project: Project): Promise<ProjectDTO> {
    const state = project.toPrimitives();
    return this.projectRepository.update(state.id, {
      name: state.name,
      description: state.description,
      goal: state.goal,
      status: state.status,
      budget: state.budget,
      costAccrued: state.costAccrued,
    });
  }

  private async startDefaultWorkflow(project: ProjectDTO): Promise<void> {
    try {
      const workflowDef = this.workflowDefinitionService.getDefaultWorkflowDefinition();
      const context: WorkflowContext = {
        projectId: project.id,
        goal: project.goal,
        variables: {
          projectName: project.name,
          projectDescription: project.description,
          budget: project.budget ?? undefined,
        },
      };
      await this.workflowEngine.startWorkflow(project.id, workflowDef.id, context);
      this.logger.log(`Started workflow for project ${project.id}`);
    } catch (error) {
      this.logger.error(`Failed to start workflow for project ${project.id}: ${(error as Error).message}`);
    }
  }
}

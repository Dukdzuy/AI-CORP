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

import { BadRequestException, ConflictException, Injectable, Inject, Logger, NotFoundException, Optional } from '@nestjs/common';
import { WorkflowContext } from '@ai-corp/shared-types';
import { IProjectRepository, PROJECT_REPOSITORY, ProjectDTO } from '../../domain/repositories';
import { Project } from '../../domain/entities/Project';
import { EventBus } from '../../domain/events/EventBus';
import { BudgetExceededEvent } from '../../domain/events/BudgetExceededEvent';
import { ProjectCreatedEvent } from '../../domain/events/ProjectCreatedEvent';
import { Money, ProjectStatus } from '../../domain/value-objects';
import { WorkflowBlockedError, WorkflowEngine } from '../workflow/workflow.engine';
import { ProjectWorkspace } from '../workspace/project-workspace.service';
import { WorkflowDefinitionService } from '../workflow/workflow-definition.service';
import { CreateProjectDto, UpdateProjectDto } from './projects.dto';
import { applyDomainRule } from './domain-rule';

/** A new project and whether its workflow started (it is kept either way) */
export type CreatedProject = ProjectDTO & { workflowStarted: boolean; workflowError?: string };

@Injectable()
export class ProjectApplicationService {
  private readonly logger = new Logger(ProjectApplicationService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projectRepository: IProjectRepository,
    private readonly eventBus: EventBus,
    private readonly workflowEngine: WorkflowEngine,
    private readonly workflowDefinitionService: WorkflowDefinitionService,
    @Optional() private readonly workspace?: ProjectWorkspace,
  ) {}

  /** Projects, newest first, each with its latest run's position in its workflow */
  async listProjects(): Promise<ProjectDTO[]> {
    const projects = await this.projectRepository.findAll({ orderBy: 'createdAt', order: 'desc' });
    return projects.map(project => {
      const run = project.latestRun;
      if (!run) return project;
      const nodes = this.workflowEngine.definitionOf(run)?.nodes ?? [];
      const index = nodes.findIndex(n => n.id === run.currentNodeId);
      return { ...project, latestRun: { ...run, nodeIndex: index, nodeCount: nodes.length } };
    });
  }

  /**
   * Create a new project, raise ProjectCreatedEvent and start its workflow
   */
  async createProject(data: CreateProjectDto & { createdById: string }): Promise<CreatedProject> {
    // 0. Reject a bad template choice before anything is created (throws 404 / 400)
    if (data.templateId) {
      this.workflowDefinitionService.previewTemplate(data.templateId, data.templateParams || {});
    }

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

    // 4. Kick off the default agent workflow; the project is kept when this fails, and the
    //    response says so, so the web app can offer to start it again
    const workflow = await this.startWorkflow(dto, data.templateId, data.templateParams);

    return { ...dto, workflowStarted: workflow.started, ...(workflow.error ? { workflowError: workflow.error } : {}) };
  }

  /**
   * Start the default workflow again for a project whose workflow never started or stopped
   * (failed, cancelled). Refused while a run is still running or paused.
   */
  async startProjectWorkflow(id: string): Promise<{ workflowStarted: boolean; workflowError?: string }> {
    const project = await this.load(id);
    if (!project.getStatus().isActive()) {
      throw new BadRequestException(`Only an active project can start its workflow (this one is ${project.getStatus().toString()})`);
    }
    const latest = await this.workflowEngine.latestRun(id);
    if (latest && (latest.status === 'running' || latest.status === 'paused')) {
      throw new ConflictException(`The project's workflow is already ${latest.status}`);
    }
    const dto = await this.projectRepository.findById(id);
    const workflow = await this.startWorkflow(dto!);
    return { workflowStarted: workflow.started, ...(workflow.error ? { workflowError: workflow.error } : {}) };
  }

  async getProjectDetails(id: string) {
    // Independent reads, run together (Phase 6 load test: sequential reads made this the slowest GET)
    const [project, projectWithMilestones, projectWithTasks, projectWithWorkflows] = await Promise.all([
      this.projectRepository.findById(id),
      this.projectRepository.findWithMilestones(id),
      this.projectRepository.findWithTasks(id),
      this.projectRepository.findWithWorkflowRuns(id, 10),
    ]);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

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
    const statusBefore = project.getStatus().toString();

    applyDomainRule(() => {
      project.updateDetails(data.name, data.description, data.goal);
      if (data.budget !== undefined) {
        project.updateBudget(data.budget !== null ? Money.dollars(data.budget) : null);
      }
      if (data.status !== undefined) {
        project.transitionTo(ProjectStatus.fromString(data.status));
      }
    });

    // Saved first, so a budget raised in the same request counts when the run resumes
    let dto = await this.persist(project);

    // The project's status drives its workflow: pausing the project pauses the run, and so on
    const statusAfter = project.getStatus().toString();
    if (statusAfter !== statusBefore) {
      try {
        await this.applyStatusToWorkflow(id, statusAfter);
      } catch (error) {
        // The run could not follow (e.g. budget still used up): the project keeps its old status
        dto = await this.projectRepository.update(id, { status: statusBefore });
        throw error;
      }
    }

    this.logger.log(`Updated project ${id}`);
    return dto;
  }

  /**
   * Pause / resume / stop the project's latest run to match the project's new status.
   * Resuming is refused while the budget is used up; a run waiting for an approval stays waiting.
   */
  private async applyStatusToWorkflow(projectId: string, status: string): Promise<void> {
    const run = await this.workflowEngine.latestRun(projectId);
    if (!run) return;

    if (status === 'paused' && run.status === 'running') {
      await this.workflowEngine.pauseWorkflow(run.id);
    } else if (status === 'active' && run.status === 'paused') {
      try {
        await this.workflowEngine.resumeWorkflow(run.id);
      } catch (error) {
        if (error instanceof WorkflowBlockedError && error.reason === 'awaiting_approval') return;
        throw new BadRequestException((error as Error).message);
      }
    } else if ((status === 'cancelled' || status === 'completed') && (run.status === 'running' || run.status === 'paused')) {
      await this.workflowEngine.cancelWorkflow(run.id, `Project ${status}`);
    }
  }

  async deleteProject(id: string) {
    await this.load(id);

    // Stop the run first so no agent keeps writing to a project that is going away
    const run = await this.workflowEngine.latestRun(id);
    if (run && (run.status === 'running' || run.status === 'paused')) {
      await this.workflowEngine.cancelWorkflow(run.id, 'Project deleted');
    }

    await this.projectRepository.delete(id);
    await this.workspace?.removeProject(id).catch(err =>
      this.logger.warn(`Could not remove the workspace of project ${id}: ${(err as Error).message}`)
    );

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

  /**
   * Start the project's workflow: the chosen template instantiated with its parameters (Task 19),
   * or the default workflow. The run is pinned to the definition version it starts with (Task 17).
   */
  private async startWorkflow(project: ProjectDTO, templateId?: string, templateParams?: Record<string, unknown>): Promise<{ started: boolean; error?: string }> {
    try {
      const variables: Record<string, unknown> = {
        projectName: project.name,
        projectDescription: project.description,
        budget: project.budget ?? undefined,
      };
      let workflowDef = this.workflowDefinitionService.getDefaultWorkflowDefinition();
      if (templateId) {
        const { definition, instance } = await this.workflowDefinitionService.instantiateTemplate(templateId, templateParams || {});
        workflowDef = definition;
        variables.workflowTemplate = { id: templateId, parameters: instance.parameters };
      }
      const context: WorkflowContext = {
        projectId: project.id,
        goal: project.goal,
        variables,
      };
      await this.workflowEngine.startWorkflow(project.id, workflowDef.id, context, workflowDef.version);
      this.logger.log(`Started workflow ${workflowDef.id}@${workflowDef.version} for project ${project.id}`);
      return { started: true };
    } catch (error) {
      this.logger.error(`Failed to start workflow for project ${project.id}: ${(error as Error).message}`);
      return { started: false, error: (error as Error).message };
    }
  }
}

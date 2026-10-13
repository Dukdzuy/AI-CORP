import { Injectable, NotFoundException, BadRequestException, Logger, Inject } from '@nestjs/common';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { WorkflowDefinitionService } from '../workflow/workflow-definition.service';
import { WorkflowContext } from '@ai-corp/shared-types';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, MinLength } from 'class-validator';
import { IProjectRepository } from '../../domain/repositories';
import { PROJECT_REPOSITORY } from '../../infrastructure/infrastructure.module';

export class CreateProjectDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  name!: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(20)
  goal!: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  budget?: number;
}

export class UpdateProjectDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsNumber()
  budget?: number;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  goal?: string;
}

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    @Inject(PROJECT_REPOSITORY) private readonly projectRepository: IProjectRepository,
    private readonly workflowEngine: WorkflowEngine,
    private readonly workflowDefinitionService: WorkflowDefinitionService,
  ) {}

  async listProjects() {
    return this.projectRepository.findAll({ orderBy: 'createdAt', order: 'desc' });
  }

  async createProject(data: CreateProjectDto & { createdById: string }) {
    if (data.budget !== undefined && data.budget <= 0) {
      throw new BadRequestException('Budget must be positive when provided.');
    }

    const project = await this.projectRepository.create({
      name: data.name,
      description: data.description,
      goal: data.goal,
      budget: data.budget,
      createdById: data.createdById,
    });

    this.logger.log(`Created project ${project.id}`);

    // Wire project creation to workflow start (Task 32.1)
    try {
      const workflowDef = this.workflowDefinitionService.getDefaultWorkflowDefinition();
      const context: WorkflowContext = {
        projectId: project.id,
        goal: data.goal,
        variables: {
          projectName: data.name,
          projectDescription: data.description,
          budget: data.budget,
        },
      };
      await this.workflowEngine.startWorkflow(project.id, workflowDef.id, context);
      this.logger.log(`Started workflow for project ${project.id}`);
    } catch (error) {
      this.logger.error(`Failed to start workflow for project ${project.id}: ${(error as Error).message}`);
    }

    return project;
  }

  async getProjectDetails(id: string) {
    const project = await this.projectRepository.findById(id);

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    // Fetch related data
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

  async updateProject(id: string, data: UpdateProjectDto) {
    if (data.budget !== undefined && data.budget <= 0) {
      throw new BadRequestException('Budget must be positive when provided.');
    }

    const project = await this.projectRepository.update(id, data);

    this.logger.log(`Updated project ${id}`);
    return project;
  }

  async pauseProject(id: string) {
    return this.updateProject(id, { status: 'paused' });
  }

  async deleteProject(id: string) {
    const project = await this.projectRepository.findById(id);
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    await this.projectRepository.delete(id);

    this.logger.log(`Deleted project ${id}`);
    return { success: true, id };
  }

  async incrementCost(id: string, cost: number) {
    // Repository handles all business logic for cost increment
    const updatedProject = await this.projectRepository.updateCost(id, cost);

    // Check if budget was exceeded (indicated by status change to 'paused')
    if (updatedProject.status === 'paused' && updatedProject.budget) {
      return {
        ...updatedProject,
        budgetExceeded: Number(updatedProject.costAccrued) >= Number(updatedProject.budget),
      };
    }

    return updatedProject;
  }
}

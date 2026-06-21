import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WorkflowEngine } from '../workflow/workflow.engine';
import { WorkflowDefinitionService } from '../workflow/workflow-definition.service';
import { WorkflowContext } from '@ai-corp/shared-types';
import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, MinLength } from 'class-validator';

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
    private readonly prisma: PrismaService,
    private readonly workflowEngine: WorkflowEngine,
    private readonly workflowDefinitionService: WorkflowDefinitionService,
  ) {}

  async listProjects() {
    return this.prisma.project.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { tasks: true, milestones: true } } },
    });
  }

  async createProject(data: CreateProjectDto & { createdById: string }) {
    if (data.budget !== undefined && data.budget <= 0) {
      throw new BadRequestException('Budget must be positive when provided.');
    }

    const project = await this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description,
        goal: data.goal,
        budget: data.budget,
        createdById: data.createdById,
      },
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
    const project = await this.prisma.project.findUnique({
      where: { id },
      include: {
        milestones: true,
        tasks: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    return project;
  }

  async updateProject(id: string, data: UpdateProjectDto) {
    if (data.budget !== undefined && data.budget <= 0) {
      throw new BadRequestException('Budget must be positive when provided.');
    }

    const project = await this.prisma.project.update({
      where: { id },
      data,
    });

    this.logger.log(`Updated project ${id}`);
    return project;
  }

  async pauseProject(id: string) {
    return this.updateProject(id, { status: 'paused' });
  }

  async incrementCost(id: string, cost: number) {
    const project = await this.prisma.project.findUnique({ where: { id } });
    if (!project) {
      throw new NotFoundException(`Project with ID ${id} not found.`);
    }

    const newCostAccrued = Number(project.costAccrued) + cost;

    // Check if budget is set
    if (project.budget) {
      const budgetLimit = Number(project.budget);
      
      // Check if costs exceed budget
      if (newCostAccrued >= budgetLimit) {
        this.logger.warn(
          `Project ${id} exceeded budget: ${newCostAccrued} >= ${budgetLimit}. Pausing project.`
        );
        
        // Auto-pause project when budget exceeded
        await this.prisma.project.update({
          where: { id },
          data: { 
            costAccrued: newCostAccrued,
            status: 'paused'
          },
        });
        
        return { 
          ...project, 
          costAccrued: newCostAccrued, 
          status: 'paused',
          budgetExceeded: true 
        };
      }
      
      // Check if approaching budget (90% threshold)
      if (newCostAccrued >= budgetLimit * 0.9 && Number(project.costAccrued) < budgetLimit * 0.9) {
        this.logger.warn(
          `Project ${id} approaching budget limit: ${newCostAccrued} >= ${budgetLimit * 0.9} (90% of ${budgetLimit})`
        );
        // Could emit WebSocket warning here
      }
    }

    const updatedProject = await this.prisma.project.update({
      where: { id },
      data: { costAccrued: newCostAccrued },
    });

    return updatedProject;
  }
}

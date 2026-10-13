import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  PrismaProjectRepository,
  PrismaTaskRepository,
  PrismaMilestoneRepository,
  PrismaAgentRepository,
  PrismaWorkflowRepository,
  PrismaApprovalRepository,
} from './persistence';

/**
 * Infrastructure Module - Dependency Injection Container
 * Provides repository implementations using injection tokens
 * Follows Dependency Inversion Principle (SOLID)
 */

// Injection tokens for repositories
export const PROJECT_REPOSITORY = Symbol('IProjectRepository');
export const TASK_REPOSITORY = Symbol('ITaskRepository');
export const MILESTONE_REPOSITORY = Symbol('IMilestoneRepository');
export const AGENT_REPOSITORY = Symbol('IAgentRepository');
export const WORKFLOW_REPOSITORY = Symbol('IWorkflowRepository');
export const APPROVAL_REPOSITORY = Symbol('IApprovalRepository');

@Module({
  imports: [PrismaModule],
  providers: [
    {
      provide: PROJECT_REPOSITORY,
      useClass: PrismaProjectRepository,
    },
    {
      provide: TASK_REPOSITORY,
      useClass: PrismaTaskRepository,
    },
    {
      provide: MILESTONE_REPOSITORY,
      useClass: PrismaMilestoneRepository,
    },
    {
      provide: AGENT_REPOSITORY,
      useClass: PrismaAgentRepository,
    },
    {
      provide: WORKFLOW_REPOSITORY,
      useClass: PrismaWorkflowRepository,
    },
    {
      provide: APPROVAL_REPOSITORY,
      useClass: PrismaApprovalRepository,
    },
  ],
  exports: [
    PROJECT_REPOSITORY,
    TASK_REPOSITORY,
    MILESTONE_REPOSITORY,
    AGENT_REPOSITORY,
    WORKFLOW_REPOSITORY,
    APPROVAL_REPOSITORY,
  ],
})
export class InfrastructureModule {}

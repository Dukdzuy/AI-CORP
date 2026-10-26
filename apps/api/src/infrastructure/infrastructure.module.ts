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
import {
  PROJECT_REPOSITORY,
  TASK_REPOSITORY,
  MILESTONE_REPOSITORY,
  AGENT_REPOSITORY,
  WORKFLOW_REPOSITORY,
  APPROVAL_REPOSITORY,
} from '../domain/repositories';

/**
 * Infrastructure Module - Dependency Injection Container
 * Provides repository implementations using injection tokens
 * Follows Dependency Inversion Principle (SOLID)
 */

// Injection tokens are owned by the domain layer; re-exported here for existing imports
export {
  PROJECT_REPOSITORY,
  TASK_REPOSITORY,
  MILESTONE_REPOSITORY,
  AGENT_REPOSITORY,
  WORKFLOW_REPOSITORY,
  APPROVAL_REPOSITORY,
};

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

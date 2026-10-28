import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import {
  PrismaProjectRepository,
  PrismaTaskRepository,
  PrismaMilestoneRepository,
  PrismaAgentRepository,
  PrismaWorkflowRepository,
  PrismaApprovalRepository,
  PrismaAuditLogRepository,
  PrismaApiKeyRepository,
  PrismaWebhookRepository,
  PrismaLlmProviderRepository,
} from './persistence';
import { AesGcmSecretCipher } from './security/AesGcmSecretCipher';
import { AUDIT_LOG_REPOSITORY } from '../domain/audit';
import { API_KEY_REPOSITORY, WEBHOOK_REPOSITORY } from '../domain/integration';
import { LLM_PROVIDER_REPOSITORY, SECRET_CIPHER } from '../domain/llm';
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
    // Phase 5
    { provide: AUDIT_LOG_REPOSITORY, useClass: PrismaAuditLogRepository },
    { provide: API_KEY_REPOSITORY, useClass: PrismaApiKeyRepository },
    { provide: WEBHOOK_REPOSITORY, useClass: PrismaWebhookRepository },
    // LLM providers configured from the web app
    { provide: LLM_PROVIDER_REPOSITORY, useClass: PrismaLlmProviderRepository },
    { provide: SECRET_CIPHER, useFactory: () => new AesGcmSecretCipher() },
  ],
  exports: [
    PROJECT_REPOSITORY,
    TASK_REPOSITORY,
    MILESTONE_REPOSITORY,
    AGENT_REPOSITORY,
    WORKFLOW_REPOSITORY,
    APPROVAL_REPOSITORY,
    AUDIT_LOG_REPOSITORY,
    API_KEY_REPOSITORY,
    WEBHOOK_REPOSITORY,
    LLM_PROVIDER_REPOSITORY,
    SECRET_CIPHER,
  ],
})
export class InfrastructureModule {}

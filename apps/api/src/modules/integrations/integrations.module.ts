import { Module } from '@nestjs/common';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { ProjectsModule } from '../projects/projects.module';
import { ReportingModule } from '../reporting/reporting.module';
import { IntegrationsService } from './integrations.service';
import { IntegrationsController } from './integrations.controller';
import { IntegrationV1Controller } from './integration-v1.controller';
import { WebhookDeliveryClient } from './webhook-delivery.client';
import { WebhookDispatcher } from './webhook.dispatcher';

/**
 * Integration API (Phase 5, Task 22): API keys, webhooks and the versioned /api/v1 facade.
 */
@Module({
  imports: [InfrastructureModule, ProjectsModule, ReportingModule],
  controllers: [IntegrationsController, IntegrationV1Controller],
  providers: [IntegrationsService, WebhookDeliveryClient, WebhookDispatcher],
  exports: [WebhookDispatcher],
})
export class IntegrationsModule {}

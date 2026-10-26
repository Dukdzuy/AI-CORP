import { Body, Controller, Delete, Get, Param, Post, Query, Req, StreamableFile } from '@nestjs/common';
import { ApiHeader, ApiOkResponse, ApiOperation, ApiProduces, ApiQuery, ApiSecurity, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Permission } from '@ai-corp/shared-types';
import { Principal } from '../../domain/security';
import { AllowApiKey, CurrentPrincipal, RequirePermission } from '../access/access.decorators';
import { Audited } from '../audit/audit.decorators';
import { ProjectApplicationService } from '../projects/project-application.service';
import { ProjectReportingService } from '../reporting/project-reporting.service';
import { ProjectExportService } from '../reporting/project-export.service';
import { ExportQueryDto, toFile } from '../reporting/reports.controller';
import { IntegrationsService } from './integrations.service';
import { CreateWebhookDto, IntegrationCreateProjectDto } from './integrations.dto';

/**
 * Versioned integration API (Phase 5, Task 22): the stable contract for external tools,
 * documented with OpenAPI at /api/docs. Accepts `x-api-key` (rate limited per key) or a
 * user's bearer token; each route still needs the permission named on it, which for a key
 * is one of its scopes.
 *
 * @pattern Facade (a small, stable surface over the application services)
 */
@ApiTags('Integration API v1')
@ApiSecurity('api-key')
@ApiHeader({ name: 'x-api-key', description: 'aic_<id>_<secret>, created under Settings → Integrations', required: true })
@ApiTooManyRequestsResponse({ description: 'Rate limit exceeded; see Retry-After and X-RateLimit-* headers' })
@AllowApiKey()
@Controller('v1')
export class IntegrationV1Controller {
  constructor(
    private readonly projects: ProjectApplicationService,
    private readonly reporting: ProjectReportingService,
    private readonly exports: ProjectExportService,
    private readonly integrations: IntegrationsService
  ) {}

  @Get('projects')
  @RequirePermission(Permission.PROJECT_READ)
  @ApiOperation({ summary: 'List projects' })
  async listProjects() {
    const all = await this.projects.listProjects();
    return all.map(p => ({ id: p.id, name: p.name, status: p.status, createdAt: p.createdAt }));
  }

  @Post('projects')
  @RequirePermission(Permission.PROJECT_CREATE)
  @Audited({ action: 'project.create', resourceType: 'Project' })
  @ApiOperation({ summary: 'Create a project and start its agent workflow' })
  async createProject(@Body() dto: IntegrationCreateProjectDto, @CurrentPrincipal() p: Principal) {
    const project = await this.projects.createProject({ ...dto, createdById: p.userId });
    return { id: project.id, name: project.name, status: project.status, statusUrl: `/api/v1/projects/${project.id}/status` };
  }

  @Get('projects/:id/status')
  @RequirePermission(Permission.PROJECT_READ)
  @ApiOperation({ summary: 'Workflow progress, tasks, cost, quality gate and traceability of a project' })
  status(@Param('id') id: string) {
    return this.reporting.status(id);
  }

  @Get('projects/:id/reports/cost')
  @RequirePermission(Permission.REPORT_VIEW)
  @ApiOperation({ summary: 'Cost report by agent, model and day' })
  cost(@Param('id') id: string) {
    return this.reporting.costReport(id);
  }

  @Get('projects/:id/export')
  @RequirePermission(Permission.PROJECT_EXPORT)
  @Audited({ action: 'project.export', resourceType: 'ProjectExport', idParam: 'id', projectIdParam: 'id' })
  @ApiOperation({ summary: 'Download the project as JSON, CSV (tasks) or PDF (report)' })
  @ApiQuery({ name: 'format', enum: ['json', 'csv', 'pdf'] })
  @ApiProduces('application/json', 'text/csv', 'application/pdf')
  @ApiOkResponse({ description: 'The file' })
  async export(@Param('id') id: string, @Query() q: ExportQueryDto, @CurrentPrincipal() p: Principal): Promise<StreamableFile> {
    return toFile(await this.exports.export(id, q.format, p.label()));
  }

  @Get('webhooks')
  @RequirePermission(Permission.INTEGRATION_MANAGE)
  @ApiOperation({ summary: 'Webhooks of the key owner' })
  listWebhooks(@CurrentPrincipal() p: Principal) {
    return this.integrations.listWebhooks(p);
  }

  @Post('webhooks')
  @RequirePermission(Permission.INTEGRATION_MANAGE)
  @Audited({ action: 'webhook.create', resourceType: 'Webhook' })
  @ApiOperation({ summary: 'Subscribe a URL to events; the response holds the signing secret (shown once)' })
  registerWebhook(@Body() dto: CreateWebhookDto, @CurrentPrincipal() p: Principal, @Req() req: any) {
    return this.integrations.registerWebhook(p, dto, req);
  }

  @Delete('webhooks/:id')
  @RequirePermission(Permission.INTEGRATION_MANAGE)
  @Audited({ action: 'webhook.delete', resourceType: 'Webhook', idParam: 'id' })
  @ApiOperation({ summary: 'Delete a webhook' })
  deleteWebhook(@Param('id') id: string, @CurrentPrincipal() p: Principal, @Req() req: any) {
    return this.integrations.deleteWebhook(p, id, req);
  }
}

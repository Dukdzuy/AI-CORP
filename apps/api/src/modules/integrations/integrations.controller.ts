import { Body, Controller, Delete, Get, HttpCode, Param, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Permission, WebhookEventName } from '@ai-corp/shared-types';
import { Principal } from '../../domain/security';
import { CurrentPrincipal, RequirePermission } from '../access/access.decorators';
import { Audited } from '../audit/audit.decorators';
import { IntegrationsService } from './integrations.service';
import { CreateApiKeyDto, CreateWebhookDto } from './integrations.dto';

/**
 * Integration settings for signed-in users (Phase 5, Task 22): issue/revoke API keys and
 * manage webhooks. JWT only: an API key can't mint more API keys.
 */
@ApiTags('Integration settings (signed-in users)')
@ApiBearerAuth()
@Controller('integrations')
@RequirePermission(Permission.INTEGRATION_MANAGE)
export class IntegrationsController {
  constructor(private readonly integrations: IntegrationsService) {}

  @Get('events')
  events() {
    return Object.values(WebhookEventName);
  }

  @Get('api-keys')
  listKeys(@CurrentPrincipal() p: Principal) {
    return this.integrations.listKeys(p);
  }

  /** The token is in this response only */
  @Post('api-keys')
  @Audited({ action: 'api_key.create', resourceType: 'ApiKey' })
  issueKey(@CurrentPrincipal() p: Principal, @Body() dto: CreateApiKeyDto) {
    return this.integrations.issueKey(p, dto);
  }

  @Delete('api-keys/:id')
  @Audited({ action: 'api_key.revoke', resourceType: 'ApiKey', idParam: 'id' })
  revokeKey(@CurrentPrincipal() p: Principal, @Param('id') id: string, @Req() req: any) {
    return this.integrations.revokeKey(p, id, req);
  }

  @Get('webhooks')
  listWebhooks(@CurrentPrincipal() p: Principal) {
    return this.integrations.listWebhooks(p);
  }

  /** The signing secret is in this response only */
  @Post('webhooks')
  @Audited({ action: 'webhook.create', resourceType: 'Webhook' })
  register(@CurrentPrincipal() p: Principal, @Body() dto: CreateWebhookDto, @Req() req: any) {
    return this.integrations.registerWebhook(p, dto, req);
  }

  @Delete('webhooks/:id')
  @Audited({ action: 'webhook.delete', resourceType: 'Webhook', idParam: 'id' })
  remove(@CurrentPrincipal() p: Principal, @Param('id') id: string, @Req() req: any) {
    return this.integrations.deleteWebhook(p, id, req);
  }

  @Post('webhooks/:id/test')
  @HttpCode(200)
  test(@CurrentPrincipal() p: Principal, @Param('id') id: string, @Req() req: any) {
    return this.integrations.testWebhook(p, id, req);
  }

  @Get('webhooks/:id/deliveries')
  deliveries(@CurrentPrincipal() p: Principal, @Param('id') id: string, @Req() req: any) {
    return this.integrations.deliveries(p, id, req);
  }
}

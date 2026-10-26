import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import {
  API_KEY_REPOSITORY,
  ApiKey,
  ApiKeyError,
  IApiKeyRepository,
  IWebhookRepository,
  InvalidWebhookUrlError,
  WEBHOOK_REPOSITORY,
  Webhook,
  WebhookError,
  WebhookUrl,
} from '../../domain/integration';
import { IProjectRepository, PROJECT_REPOSITORY } from '../../domain/repositories';
import { Principal } from '../../domain/security';
import { AuthorizationService } from '../access/authorization.service';
import { WebhookDeliveryClient } from './webhook-delivery.client';
import { WebhookDispatcher } from './webhook.dispatcher';

/**
 * Management of a principal's API keys and webhooks (Phase 5, Task 22). Everyone manages
 * their own; admins see and revoke everyone's.
 */
@Injectable()
export class IntegrationsService {
  constructor(
    @Inject(API_KEY_REPOSITORY) private readonly keys: IApiKeyRepository,
    @Inject(WEBHOOK_REPOSITORY) private readonly webhooks: IWebhookRepository,
    @Inject(PROJECT_REPOSITORY) private readonly projects: IProjectRepository,
    private readonly authorization: AuthorizationService,
    private readonly client: WebhookDeliveryClient,
    private readonly dispatcher: WebhookDispatcher
  ) {}

  // ---- API keys -------------------------------------------------------------

  async issueKey(principal: Principal, input: { name: string; scopes: string[]; expiresInDays?: number }) {
    try {
      const { apiKey, token } = ApiKey.issue({ ...input, ownerId: principal.userId, ownerRole: principal.role });
      await this.keys.save(apiKey);
      return { apiKey: apiKey.toView(), token };
    } catch (e) {
      if (e instanceof ApiKeyError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  async listKeys(principal: Principal) {
    return (await this.keys.findByOwner(principal.isAdmin() ? null : principal.userId)).map(k => k.toView());
  }

  async revokeKey(principal: Principal, id: string, request?: any) {
    const key = await this.keys.findById(id);
    if (!key) throw new NotFoundException(`API key ${id} not found`);
    await this.authorization.assertOwner(principal, key.ownerId, { type: 'ApiKey', id, verb: 'revoke' }, request);
    try {
      key.revoke();
    } catch (e) {
      throw new BadRequestException((e as Error).message);
    }
    await this.keys.save(key);
    return key.toView();
  }

  // ---- Webhooks -------------------------------------------------------------

  async registerWebhook(principal: Principal, input: { url: string; events: string[]; projectId?: string }, request?: any) {
    if (input.projectId) {
      const project = await this.projects.findById(input.projectId);
      if (!project) throw new NotFoundException(`Project with ID ${input.projectId} not found.`);
      await this.authorization.assertOwner(principal, project.createdById, { type: 'Project', id: project.id, verb: 'subscribe to' }, request);
    }
    try {
      const url = WebhookUrl.parse(input.url, { allowPrivateNetworks: this.client.allowPrivateNetworks });
      const webhook = Webhook.register({ ownerId: principal.userId, url, events: input.events, projectId: input.projectId });
      await this.webhooks.save(webhook);
      return webhook.toView(true);
    } catch (e) {
      if (e instanceof InvalidWebhookUrlError || e instanceof WebhookError) throw new BadRequestException(e.message);
      throw e;
    }
  }

  async listWebhooks(principal: Principal) {
    return (await this.webhooks.findByOwner(principal.isAdmin() ? null : principal.userId)).map(w => w.toView());
  }

  async deleteWebhook(principal: Principal, id: string, request?: any) {
    const webhook = await this.ownedWebhook(principal, id, 'delete', request);
    await this.webhooks.delete(webhook.id);
    return { id, deleted: true };
  }

  async testWebhook(principal: Principal, id: string, request?: any) {
    const webhook = await this.ownedWebhook(principal, id, 'test', request);
    return this.dispatcher.sendTest(webhook);
  }

  async deliveries(principal: Principal, id: string, request?: any) {
    const webhook = await this.ownedWebhook(principal, id, 'read', request);
    return this.webhooks.listDeliveries(webhook.id, 50);
  }

  private async ownedWebhook(principal: Principal, id: string, verb: string, request?: any) {
    const webhook = await this.webhooks.findById(id);
    if (!webhook) throw new NotFoundException(`Webhook ${id} not found`);
    await this.authorization.assertOwner(principal, webhook.ownerId, { type: 'Webhook', id, verb }, request);
    return webhook;
  }
}

import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WebhookEventName } from '@ai-corp/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { IWebhookRepository, Webhook, WebhookDeliveryRecord } from '../../domain/integration';

/**
 * Prisma implementation of IWebhookRepository (Phase 5, Task 22)
 */
@Injectable()
export class PrismaWebhookRepository implements IWebhookRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(webhook: Webhook): Promise<void> {
    const p = webhook.toPrimitives();
    await this.prisma.webhook.upsert({
      where: { id: p.id },
      create: { ...p, events: [...p.events] },
      update: { url: p.url, events: [...p.events], active: p.active, projectId: p.projectId },
    });
  }

  async findById(id: string): Promise<Webhook | null> {
    const row = await this.prisma.webhook.findUnique({ where: { id } });
    return row ? this.toEntity(row) : null;
  }

  async findByOwner(ownerId: string | null): Promise<Webhook[]> {
    const rows = await this.prisma.webhook.findMany({ where: ownerId ? { ownerId } : {}, orderBy: { createdAt: 'desc' } });
    return rows.map(r => this.toEntity(r));
  }

  async findActiveForEvent(event: string): Promise<Webhook[]> {
    const rows = await this.prisma.webhook.findMany({ where: { active: true, events: { has: event } } });
    return rows.map(r => this.toEntity(r));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.webhook.delete({ where: { id } });
  }

  async recordDelivery(d: WebhookDeliveryRecord): Promise<void> {
    await this.prisma.webhookDelivery.create({
      data: {
        webhookId: d.webhookId,
        event: d.event,
        payload: d.payload as Prisma.InputJsonValue,
        status: d.status,
        attempts: d.attempts,
        responseCode: d.responseCode,
        error: d.error,
        durationMs: d.durationMs,
      },
    });
  }

  async listDeliveries(webhookId: string, limit: number): Promise<WebhookDeliveryRecord[]> {
    const rows = await this.prisma.webhookDelivery.findMany({ where: { webhookId }, orderBy: { createdAt: 'desc' }, take: limit });
    return rows.map(r => ({ ...r, status: r.status as 'delivered' | 'failed' }));
  }

  private toEntity(row: Prisma.WebhookGetPayload<{}>): Webhook {
    return Webhook.fromPersistence({ ...row, events: row.events as WebhookEventName[] });
  }
}

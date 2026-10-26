import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { WebhookEventName } from '@ai-corp/shared-types';
import { EventBus, IEventHandler } from '../../domain/events/EventBus';
import { DomainEvent } from '../../domain/events/DomainEvent';
import { IWebhookRepository, WEBHOOK_REPOSITORY, Webhook } from '../../domain/integration';
import { WebhookDeliveryClient } from './webhook-delivery.client';
import { WEBHOOK_PAYLOADS, WebhookEnvelope, toEnvelope } from './webhook-payloads';

/**
 * Forwards domain events to subscribed webhooks (Phase 5, Task 22).
 *
 * Deliveries run in the background: the EventBus awaits its handlers, and the workflow
 * engine awaits the EventBus, so a slow receiver must never hold up a workflow. Every
 * delivery (success or final failure) is recorded with its attempts and status code.
 *
 * @pattern Observer (EventBus subscriber), Adapter (event → public payload)
 */
@Injectable()
export class WebhookDispatcher implements IEventHandler, OnModuleInit {
  private readonly logger = new Logger(WebhookDispatcher.name);
  private readonly inFlight = new Set<Promise<void>>();

  constructor(
    private readonly eventBus: EventBus,
    @Inject(WEBHOOK_REPOSITORY) private readonly webhooks: IWebhookRepository,
    private readonly client: WebhookDeliveryClient
  ) {}

  onModuleInit() {
    for (const event of Object.keys(WEBHOOK_PAYLOADS)) this.eventBus.subscribe(event, this);
  }

  async handle(event: DomainEvent): Promise<void> {
    const envelope = toEnvelope(event);
    if (!envelope) return;
    const targets = (await this.webhooks.findActiveForEvent(envelope.event)).filter(w => w.subscribesTo(envelope.event, envelope.projectId));
    for (const webhook of targets) this.track(this.deliver(webhook, envelope));
  }

  /** Sends a `webhook.test` ping and waits for the outcome (used by the "Send test" button) */
  async sendTest(webhook: Webhook) {
    const envelope: WebhookEnvelope = {
      id: `test-${Date.now()}`,
      event: 'webhook.test',
      occurredAt: new Date().toISOString(),
      projectId: webhook.projectId,
      data: { message: 'Test delivery from AI Corp', subscribedEvents: webhook.events as WebhookEventName[] },
    };
    return this.deliver(webhook, envelope, true);
  }

  /** Resolves when every background delivery started so far has finished (tests, shutdown) */
  async drain(): Promise<void> {
    while (this.inFlight.size) await Promise.allSettled([...this.inFlight]);
  }

  private track(p: Promise<unknown>) {
    const tracked = p.then(() => undefined, () => undefined);
    this.inFlight.add(tracked);
    tracked.finally(() => this.inFlight.delete(tracked));
  }

  private async deliver(webhook: Webhook, envelope: WebhookEnvelope, rethrow = false) {
    const outcome = await this.client.deliver(webhook.url, webhook.secret, envelope);
    try {
      await this.webhooks.recordDelivery({
        webhookId: webhook.id,
        event: envelope.event,
        payload: envelope,
        status: outcome.ok ? 'delivered' : 'failed',
        attempts: outcome.attempts,
        responseCode: outcome.responseCode,
        error: outcome.error,
        durationMs: outcome.durationMs,
      });
    } catch (error) {
      this.logger.error(`Delivery of ${envelope.event} to webhook ${webhook.id} not recorded: ${(error as Error).message}`);
      if (rethrow) throw error;
    }
    if (!outcome.ok) this.logger.warn(`Webhook ${webhook.id} ${envelope.event} failed after ${outcome.attempts} attempt(s): ${outcome.error}`);
    return outcome;
  }
}

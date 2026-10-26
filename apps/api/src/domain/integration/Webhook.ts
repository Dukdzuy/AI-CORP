/**
 * Webhook (Phase 5, Task 22)
 *
 * A subscription of an external URL to platform events, optionally limited to one project.
 * Every delivery is signed with the webhook's secret (see WebhookSignature).
 *
 * @pattern Entity, Observer (the dispatcher notifies subscribed webhooks)
 */
import { randomBytes, randomUUID } from 'crypto';
import { WebhookEventName } from '@ai-corp/shared-types';
import { WebhookUrl } from './WebhookUrl';

export interface WebhookProps {
  id: string;
  ownerId: string;
  projectId: string | null;
  url: string;
  events: WebhookEventName[];
  secret: string;
  active: boolean;
  createdAt: Date;
}

export class WebhookError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WebhookError';
  }
}

export const WEBHOOK_EVENTS = Object.values(WebhookEventName) as WebhookEventName[];

export class Webhook {
  private constructor(private props: WebhookProps) {}

  static register(params: {
    ownerId: string;
    url: WebhookUrl;
    events: string[];
    projectId?: string | null;
  }): Webhook {
    if (!params.events?.length) throw new WebhookError('Subscribe the webhook to at least one event');
    const unknown = params.events.filter(e => !WEBHOOK_EVENTS.includes(e as WebhookEventName));
    if (unknown.length) {
      throw new WebhookError(`Unknown event(s): ${unknown.join(', ')}. Known: ${WEBHOOK_EVENTS.join(', ')}`);
    }
    return new Webhook({
      id: randomUUID(),
      ownerId: params.ownerId,
      projectId: params.projectId ?? null,
      url: params.url.value,
      events: [...new Set(params.events)] as WebhookEventName[],
      secret: `whsec_${randomBytes(24).toString('base64url')}`,
      active: true,
      createdAt: new Date(),
    });
  }

  static fromPersistence(props: WebhookProps): Webhook {
    return new Webhook({ ...props });
  }

  /** Global webhooks (no project) receive the event of every project */
  subscribesTo(event: string, projectId: string | null | undefined): boolean {
    if (!this.props.active) return false;
    if (!this.props.events.includes(event as WebhookEventName)) return false;
    return !this.props.projectId || this.props.projectId === projectId;
  }

  deactivate(): void {
    this.props = { ...this.props, active: false };
  }

  get id() { return this.props.id; }
  get ownerId() { return this.props.ownerId; }
  get projectId() { return this.props.projectId; }
  get url() { return this.props.url; }
  get secret() { return this.props.secret; }
  get events(): readonly WebhookEventName[] { return this.props.events; }

  toPrimitives(): WebhookProps {
    return { ...this.props, events: [...this.props.events] };
  }

  /** The secret is only returned when the webhook is created */
  toView(includeSecret = false) {
    const { secret, ...rest } = this.toPrimitives();
    return includeSecret ? { ...rest, secret } : { ...rest, secretHint: `${secret.slice(0, 10)}…` };
  }
}

export interface WebhookDeliveryRecord {
  id?: string;
  webhookId: string;
  event: string;
  payload: unknown;
  status: 'delivered' | 'failed';
  attempts: number;
  responseCode: number | null;
  error: string | null;
  durationMs: number;
  createdAt?: Date;
}

export interface IWebhookRepository {
  save(webhook: Webhook): Promise<void>;
  findById(id: string): Promise<Webhook | null>;
  findByOwner(ownerId: string | null): Promise<Webhook[]>;
  findActiveForEvent(event: string): Promise<Webhook[]>;
  delete(id: string): Promise<void>;
  recordDelivery(delivery: WebhookDeliveryRecord): Promise<void>;
  listDeliveries(webhookId: string, limit: number): Promise<WebhookDeliveryRecord[]>;
}

export const WEBHOOK_REPOSITORY = Symbol('IWebhookRepository');

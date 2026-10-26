import http from 'http';
import { AddressInfo } from 'net';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EventBus } from '../../../src/domain/events/EventBus';
import { WorkflowCompletedEvent } from '../../../src/domain/events/WorkflowCompletedEvent';
import { WorkflowFailedEvent } from '../../../src/domain/events/WorkflowFailedEvent';
import { TaskAssignedEvent } from '../../../src/domain/events/TaskAssignedEvent';
import { Webhook, WebhookSignature, WebhookUrl } from '../../../src/domain/integration';
import { WebhookDeliveryClient } from '../../../src/modules/integrations/webhook-delivery.client';
import { WebhookDispatcher } from '../../../src/modules/integrations/webhook.dispatcher';
import { InMemoryWebhookRepository } from './in-memory';

type Received = { headers: http.IncomingHttpHeaders; body: string };

describe('Phase 5 / Task 22: webhook delivery', () => {
  let server: http.Server;
  let url: string;
  const received: Received[] = [];
  let answers: number[] = [];
  let delayMs = 0;

  const config = (values: Record<string, unknown>) => ({ get: (k: string, d?: unknown) => (k in values ? values[k] : d) }) as unknown as ConfigService;

  function setup(allowPrivate = true) {
    const bus = new EventBus();
    const repo = new InMemoryWebhookRepository();
    const client = new WebhookDeliveryClient(config({ WEBHOOK_ALLOW_PRIVATE_NETWORKS: String(allowPrivate), WEBHOOK_RETRY_BASE_MS: 5, WEBHOOK_TIMEOUT_MS: 500 }));
    const dispatcher = new WebhookDispatcher(bus, repo, client);
    dispatcher.onModuleInit();
    const add = async (events: string[], projectId?: string) => {
      const w = Webhook.register({ ownerId: 'u1', url: WebhookUrl.parse(`${url}/hook`, { allowPrivateNetworks: true }), events, projectId });
      await repo.save(w);
      return w;
    };
    return { bus, repo, dispatcher, add };
  }

  beforeAll(async () => {
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    server = http.createServer((req, res) => {
      let body = '';
      req.on('data', c => (body += c));
      req.on('end', async () => {
        received.push({ headers: req.headers, body });
        if (delayMs) await new Promise(r => setTimeout(r, delayMs));
        res.writeHead(answers.shift() ?? 200).end();
      });
    });
    await new Promise<void>(r => server.listen(0, '127.0.0.1', () => r()));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(async () => {
    await new Promise(r => server.close(r));
    jest.restoreAllMocks();
  });
  beforeEach(() => {
    received.length = 0;
    answers = [];
    delayMs = 0;
  });

  it('delivers a subscribed event as a signed public payload and records the delivery', async () => {
    const { bus, repo, dispatcher, add } = setup();
    const hook = await add(['workflow.completed']);
    const event = new WorkflowCompletedEvent('p1', 'run-1');
    await bus.publish(event);
    await dispatcher.drain();

    expect(received).toHaveLength(1);
    const { headers, body } = received[0];
    expect(headers['x-aicorp-event']).toBe('workflow.completed');
    expect(WebhookSignature.verify(hook.secret, Number(headers['x-aicorp-timestamp']), body, String(headers['x-aicorp-signature']))).toBe(true);
    expect(JSON.parse(body)).toEqual({ id: event.eventId, event: 'workflow.completed', occurredAt: event.occurredOn.toISOString(), projectId: 'p1', data: { runId: 'run-1' } });
    expect(repo.deliveries[0]).toMatchObject({ webhookId: hook.id, status: 'delivered', attempts: 1, responseCode: 200 });
  });

  it('retries server errors with backoff and gives up on client errors', async () => {
    const { bus, repo, dispatcher, add } = setup();
    await add(['workflow.failed']);
    answers = [500, 503, 200];
    await bus.publish(new WorkflowFailedEvent('p1', 'r1', 'develop', 'boom'));
    await dispatcher.drain();
    expect(repo.deliveries[0]).toMatchObject({ status: 'delivered', attempts: 3 });
    expect(new Set(received.map(r => r.headers['x-aicorp-delivery'])).size).toBe(1); // same delivery id on every retry

    answers = [404];
    await bus.publish(new WorkflowFailedEvent('p1', 'r2', 'develop', 'boom'));
    await dispatcher.drain();
    expect(repo.deliveries[1]).toMatchObject({ status: 'failed', attempts: 1, responseCode: 404, error: 'HTTP 404' });
  });

  it('only sends to webhooks of the event and project, and never internal events', async () => {
    const { bus, dispatcher, add } = setup();
    await add(['workflow.completed'], 'p2');
    await add(['project.created']);
    await bus.publish(new WorkflowCompletedEvent('p1', 'r1'));
    await bus.publish(new TaskAssignedEvent('t1', 'p1', 'DEV', 'x'));
    await dispatcher.drain();
    expect(received).toHaveLength(0);
  });

  it('does not hold up the publisher while a receiver is slow', async () => {
    const { bus, dispatcher, add } = setup();
    await add(['workflow.completed']);
    delayMs = 300;
    const started = Date.now();
    await bus.publish(new WorkflowCompletedEvent('p1', 'r1'));
    expect(Date.now() - started).toBeLessThan(150);
    await dispatcher.drain();
    expect(received).toHaveLength(1);
  });

  it('refuses at send time to deliver to a private address unless allowed', async () => {
    const { bus, repo, dispatcher, add } = setup(false);
    await add(['workflow.completed']);
    await bus.publish(new WorkflowCompletedEvent('p1', 'r1'));
    await dispatcher.drain();
    expect(received).toHaveLength(0);
    expect(repo.deliveries[0]).toMatchObject({ status: 'failed', attempts: 1, error: expect.stringMatching(/private/) });
  });

  it('sends a test ping on request and returns the outcome', async () => {
    const { dispatcher, add } = setup();
    const hook = await add(['workflow.completed']);
    const outcome = await dispatcher.sendTest(hook);
    expect(outcome).toMatchObject({ ok: true, responseCode: 200 });
    expect(JSON.parse(received[0].body)).toMatchObject({ event: 'webhook.test', data: { subscribedEvents: ['workflow.completed'] } });
  });
});

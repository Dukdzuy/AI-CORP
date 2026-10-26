import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { lookup } from 'dns/promises';
import { randomUUID } from 'crypto';
import { isIP } from 'net';
import { WebhookSignature, WebhookUrl } from '../../domain/integration';
import { WebhookEnvelope } from './webhook-payloads';

export interface DeliveryOutcome {
  ok: boolean;
  attempts: number;
  responseCode: number | null;
  error: string | null;
  durationMs: number;
}

/**
 * Sends one signed webhook request, with retries (Phase 5, Task 22).
 *
 * Headers: X-AICorp-Event, X-AICorp-Delivery, X-AICorp-Timestamp and
 * X-AICorp-Signature (`sha256=` HMAC of "<timestamp>.<body>" with the webhook secret).
 * A 2xx answer is a success; 4xx (except 408/429) is final; 5xx, timeouts and network
 * errors are retried with exponential backoff. Before each attempt the host name is
 * resolved and private addresses are refused unless WEBHOOK_ALLOW_PRIVATE_NETWORKS=true.
 */
@Injectable()
export class WebhookDeliveryClient {
  constructor(private readonly config: ConfigService) {}

  get allowPrivateNetworks(): boolean {
    return String(this.config.get('WEBHOOK_ALLOW_PRIVATE_NETWORKS', 'false')) === 'true';
  }

  async deliver(url: string, secret: string, envelope: WebhookEnvelope): Promise<DeliveryOutcome> {
    const maxAttempts = Number(this.config.get('WEBHOOK_MAX_ATTEMPTS', 3));
    const baseDelay = Number(this.config.get('WEBHOOK_RETRY_BASE_MS', 1000));
    const timeoutMs = Number(this.config.get('WEBHOOK_TIMEOUT_MS', 5000));
    const body = JSON.stringify(envelope);
    const deliveryId = randomUUID();
    const started = Date.now();
    let last: { code: number | null; error: string | null } = { code: null, error: null };

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        // A refused target is final: retrying would not change the address
        const refusal = await this.refusalFor(url);
        if (refusal) return { ok: false, attempts: attempt, responseCode: null, error: refusal, durationMs: Date.now() - started };
        const timestamp = Math.floor(Date.now() / 1000);
        const response = await fetch(url, {
          method: 'POST',
          redirect: 'manual',
          signal: AbortSignal.timeout(timeoutMs),
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'AI-Corp-Webhooks/1.0',
            'X-AICorp-Event': envelope.event,
            'X-AICorp-Delivery': deliveryId,
            'X-AICorp-Timestamp': String(timestamp),
            'X-AICorp-Signature': WebhookSignature.sign(secret, timestamp, body),
          },
          body,
        });
        last = { code: response.status, error: response.ok ? null : `HTTP ${response.status}` };
        if (response.ok) return { ok: true, attempts: attempt, responseCode: response.status, error: null, durationMs: Date.now() - started };
        const retryable = response.status >= 500 || response.status === 408 || response.status === 429;
        if (!retryable) return { ok: false, attempts: attempt, responseCode: response.status, error: last.error, durationMs: Date.now() - started };
      } catch (error) {
        last = { code: null, error: (error as Error).message };
      }
      if (attempt < maxAttempts) await new Promise(r => setTimeout(r, baseDelay * 2 ** (attempt - 1)));
    }
    return { ok: false, attempts: maxAttempts, responseCode: last.code, error: last.error, durationMs: Date.now() - started };
  }

  /**
   * Re-checks at send time: a public name can resolve to an internal address (DNS rebinding).
   * Returns why the target is refused, or null; a failing DNS lookup throws and is retried.
   */
  private async refusalFor(url: string): Promise<string | null> {
    if (this.allowPrivateNetworks) return null;
    let hostname: string;
    try {
      hostname = WebhookUrl.parse(url, { allowPrivateNetworks: false }).hostname;
    } catch (error) {
      return (error as Error).message;
    }
    const addresses = isIP(hostname) ? [{ address: hostname }] : await lookup(hostname, { all: true });
    const blocked = addresses.find(a => WebhookUrl.isPrivateAddress(a.address));
    return blocked ? `Refused to deliver to private address ${blocked.address} (${hostname})` : null;
  }
}

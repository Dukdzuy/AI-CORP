/**
 * WebhookSignature (Phase 5, Task 22)
 *
 * `X-AICorp-Signature: sha256=<hex HMAC of "<timestamp>.<body>">`. Including the timestamp
 * lets receivers reject replays older than their tolerance.
 */
import { createHmac, timingSafeEqual } from 'crypto';

export class WebhookSignature {
  static sign(secret: string, timestamp: number, body: string): string {
    return `sha256=${createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex')}`;
  }

  static verify(secret: string, timestamp: number, body: string, signature: string, toleranceSec = 300, nowMs = Date.now()): boolean {
    if (Math.abs(nowMs / 1000 - timestamp) > toleranceSec) return false;
    const expected = Buffer.from(WebhookSignature.sign(secret, timestamp, body));
    const given = Buffer.from(signature ?? '');
    return expected.length === given.length && timingSafeEqual(expected, given);
  }
}

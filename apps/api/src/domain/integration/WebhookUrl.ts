/**
 * WebhookUrl Value Object (Phase 5, Task 22)
 *
 * Syntactic rules for a webhook target, plus the address classification used to stop the
 * server from being turned into a proxy into its own network (SSRF). Name resolution
 * happens in infrastructure, which re-checks every resolved address with `isPrivateAddress`.
 *
 * @pattern Value Object
 */
import { isIP } from 'net';

export class InvalidWebhookUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWebhookUrlError';
  }
}

export class WebhookUrl {
  private constructor(readonly value: string, readonly hostname: string) {}

  static parse(raw: string, options: { allowPrivateNetworks: boolean }): WebhookUrl {
    let url: URL;
    try {
      url = new URL(raw);
    } catch {
      throw new InvalidWebhookUrlError(`'${raw}' is not a valid URL`);
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new InvalidWebhookUrlError('Webhook URL must use http or https');
    }
    if (url.username || url.password) {
      throw new InvalidWebhookUrlError('Webhook URL must not contain credentials');
    }
    if (raw.length > 2000) throw new InvalidWebhookUrlError('Webhook URL is too long');

    const hostname = url.hostname.replace(/^\[|\]$/g, '');
    if (!options.allowPrivateNetworks && (hostname === 'localhost' || hostname.endsWith('.localhost') || WebhookUrl.isPrivateAddress(hostname))) {
      throw new InvalidWebhookUrlError(`Webhook URL points to a private or local address (${hostname})`);
    }
    return new WebhookUrl(url.toString(), hostname);
  }

  /** Loopback, private, link-local, CGNAT and unspecified ranges (IPv4 and IPv6) */
  static isPrivateAddress(address: string): boolean {
    const kind = isIP(address);
    if (kind === 4) {
      const [a, b] = address.split('.').map(Number);
      return (
        a === 10 || a === 127 || a === 0 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127)
      );
    }
    if (kind === 6) {
      const v = address.toLowerCase();
      if (v === '::1' || v === '::') return true;
      if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
      // IPv4-mapped addresses, dotted (::ffff:127.0.0.1) or as URL normalises them (::ffff:7f00:1)
      const dotted = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(v);
      if (dotted) return WebhookUrl.isPrivateAddress(dotted[1]);
      const hex = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/.exec(v);
      if (hex) {
        const [hi, lo] = [parseInt(hex[1], 16), parseInt(hex[2], 16)];
        return WebhookUrl.isPrivateAddress(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
      }
      return false;
    }
    return false;
  }
}

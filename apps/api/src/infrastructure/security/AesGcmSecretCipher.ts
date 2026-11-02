import { Injectable, Logger } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { SecretCipher } from '../../domain/llm';

const VERSION = 'v1';
const DEV_FALLBACK = 'ai-corp-dev-only-llm-secret';

/**
 * AES-256-GCM implementation of SecretCipher. Sealed form: `v1:<iv>:<tag>:<ciphertext>`
 * (base64). The key is SHA-256 of LLM_SECRET_KEY, falling back to JWT_SECRET; changing
 * the key makes stored provider keys unreadable, so they must be entered again.
 */
@Injectable()
export class AesGcmSecretCipher implements SecretCipher {
  private readonly logger = new Logger(AesGcmSecretCipher.name);
  private readonly key: Buffer;

  constructor(secret?: string) {
    const source = secret || process.env.LLM_SECRET_KEY || process.env.JWT_SECRET;
    if (!source) {
      if (process.env.NODE_ENV === 'production') throw new Error('LLM_SECRET_KEY (or JWT_SECRET) must be set to store provider API keys');
      this.logger.warn('LLM_SECRET_KEY is not set; provider API keys use a development-only key');
    }
    this.key = createHash('sha256').update(source || DEV_FALLBACK).digest();
  }

  encrypt(plain: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    return [VERSION, iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
  }

  decrypt(sealed: string): string {
    const [version, iv, tag, data] = sealed.split(':');
    if (version !== VERSION || !iv || !tag || data === undefined) throw new Error('Unrecognised encrypted secret');
    const decipher = createDecipheriv('aes-256-gcm', this.key, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
  }
}

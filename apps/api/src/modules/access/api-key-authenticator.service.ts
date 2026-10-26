import { Inject, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { API_KEY_REPOSITORY, ApiKey, IApiKeyRepository } from '../../domain/integration';
import { Principal } from '../../domain/security';

export type ApiKeyAuthResult = { ok: true; principal: Principal } | { ok: false; reason: string };

/**
 * Turns an `x-api-key` header into a Principal (Phase 5, Task 22).
 * The key must parse, exist, match its hash, be neither revoked nor expired, and its owner
 * must still be an active user. Its permissions are the key's scopes ∩ the owner's role.
 */
@Injectable()
export class ApiKeyAuthenticator {
  private readonly logger = new Logger(ApiKeyAuthenticator.name);

  constructor(
    @Inject(API_KEY_REPOSITORY) private readonly keys: IApiKeyRepository,
    private readonly prisma: PrismaService
  ) {}

  async authenticate(token: string, now = new Date()): Promise<ApiKeyAuthResult> {
    const parsed = ApiKey.parse(token);
    if (!parsed) return { ok: false, reason: 'Malformed API key' };

    const key = await this.keys.findById(parsed.keyId);
    if (!key || !key.matches(parsed.secret)) return { ok: false, reason: 'Unknown API key' };
    if (!key.isUsable(now)) return { ok: false, reason: 'API key is revoked or expired' };

    const owner = await this.prisma.user.findUnique({ where: { id: key.ownerId } });
    if (!owner || !owner.isActive) return { ok: false, reason: 'API key owner is no longer active' };

    this.keys.touch(key.id, now).catch(err => this.logger.warn(`Could not update lastUsedAt of key ${key.id}: ${err.message}`));
    return {
      ok: true,
      principal: Principal.forApiKey({ id: owner.id, email: owner.email, name: owner.name, role: owner.role }, key),
    };
  }
}

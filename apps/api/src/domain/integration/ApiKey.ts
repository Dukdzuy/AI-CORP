/**
 * ApiKey (Phase 5, Task 22)
 *
 * A credential an external tool uses instead of a user's password. The token is
 * `aic_<keyId>_<secret>`; only the SHA-256 hash of the secret is kept, so the token is
 * shown once, at issue time. Scopes must be permissions the owner's role already has.
 *
 * @pattern Entity, Factory Method
 */
import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { Permission } from '@ai-corp/shared-types';
import { RolePolicy } from '../security/RolePolicy';
import { UserRole } from '../security/UserRole';

export interface ApiKeyProps {
  id: string;
  name: string;
  ownerId: string;
  secretHash: string;
  scopes: Permission[];
  createdAt: Date;
  expiresAt: Date | null;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
}

export class ApiKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ApiKeyError';
  }
}

const TOKEN_FORMAT = /^aic_([a-z0-9]{12})_([A-Za-z0-9_-]{32,})$/;

export class ApiKey {
  private constructor(private props: ApiKeyProps) {}

  static issue(params: {
    name: string;
    ownerId: string;
    ownerRole: UserRole;
    scopes: string[];
    now?: Date;
    expiresInDays?: number;
  }): { apiKey: ApiKey; token: string } {
    const name = params.name?.trim();
    if (!name || name.length > 80) throw new ApiKeyError('API key name must be 1-80 characters');
    if (!params.scopes?.length) throw new ApiKeyError('An API key needs at least one scope');

    const allowed = RolePolicy.permissionsOf(params.ownerRole);
    const unknown = params.scopes.filter(s => !RolePolicy.allPermissions().includes(s as Permission));
    if (unknown.length) throw new ApiKeyError(`Unknown scope(s): ${unknown.join(', ')}`);
    const beyondRole = params.scopes.filter(s => !allowed.includes(s as Permission));
    if (beyondRole.length) {
      throw new ApiKeyError(`Role '${params.ownerRole}' cannot grant scope(s): ${beyondRole.join(', ')}`);
    }
    if (params.expiresInDays !== undefined && (params.expiresInDays < 1 || params.expiresInDays > 365)) {
      throw new ApiKeyError('expiresInDays must be between 1 and 365');
    }

    const now = params.now ?? new Date();
    const id = randomBytes(9).toString('base64url').toLowerCase().replace(/[^a-z0-9]/g, '0').slice(0, 12);
    const secret = randomBytes(24).toString('base64url');
    const apiKey = new ApiKey({
      id,
      name,
      ownerId: params.ownerId,
      secretHash: ApiKey.hash(secret),
      scopes: [...new Set(params.scopes)] as Permission[],
      createdAt: now,
      expiresAt: params.expiresInDays ? new Date(now.getTime() + params.expiresInDays * 86_400_000) : null,
      lastUsedAt: null,
      revokedAt: null,
    });
    return { apiKey, token: `aic_${id}_${secret}` };
  }

  static fromPersistence(props: ApiKeyProps): ApiKey {
    return new ApiKey({ ...props });
  }

  /** Splits a presented token; null when it is not shaped like one of ours */
  static parse(token: string): { keyId: string; secret: string } | null {
    const m = TOKEN_FORMAT.exec(token?.trim() ?? '');
    return m ? { keyId: m[1], secret: m[2] } : null;
  }

  private static hash(secret: string): string {
    return createHash('sha256').update(secret).digest('hex');
  }

  /** Constant-time comparison of the presented secret with the stored hash */
  matches(secret: string): boolean {
    const a = Buffer.from(ApiKey.hash(secret), 'hex');
    const b = Buffer.from(this.props.secretHash, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  }

  isUsable(now = new Date()): boolean {
    if (this.props.revokedAt) return false;
    return !this.props.expiresAt || this.props.expiresAt.getTime() > now.getTime();
  }

  revoke(now = new Date()): void {
    if (this.props.revokedAt) throw new ApiKeyError('API key is already revoked');
    this.props = { ...this.props, revokedAt: now };
  }

  markUsed(now = new Date()): void {
    this.props = { ...this.props, lastUsedAt: now };
  }

  get id() { return this.props.id; }
  get name() { return this.props.name; }
  get ownerId() { return this.props.ownerId; }
  get scopes(): readonly Permission[] { return this.props.scopes; }

  toPrimitives(): ApiKeyProps {
    return { ...this.props, scopes: [...this.props.scopes] };
  }

  /** What the API returns: never the hash */
  toView() {
    const { secretHash: _hash, ...view } = this.toPrimitives();
    return { ...view, prefix: `aic_${this.props.id}_…`, status: this.props.revokedAt ? 'revoked' : this.isUsable() ? 'active' : 'expired' };
  }
}

export interface IApiKeyRepository {
  save(key: ApiKey): Promise<void>;
  findById(id: string): Promise<ApiKey | null>;
  findByOwner(ownerId: string | null): Promise<ApiKey[]>;
  touch(id: string, at: Date): Promise<void>;
}

export const API_KEY_REPOSITORY = Symbol('IApiKeyRepository');

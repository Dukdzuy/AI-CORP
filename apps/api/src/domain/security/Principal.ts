/**
 * Principal (Phase 5, Tasks 20 and 22)
 *
 * Who is making a request, and what they may do. A user principal gets its role's
 * permissions; an API-key principal gets the key's scopes, never more than its owner's
 * role allows (intersection), so a key can't outlive a demotion of its owner.
 *
 * @pattern Value Object
 */
import { Permission } from '@ai-corp/shared-types';
import { RolePolicy } from './RolePolicy';
import { UserRole } from './UserRole';

export type PrincipalKind = 'user' | 'api_key';

export interface PrincipalUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

export class Principal {
  private readonly permissions: ReadonlySet<Permission>;

  private constructor(
    readonly kind: PrincipalKind,
    readonly user: PrincipalUser,
    readonly role: UserRole,
    permissions: Iterable<Permission>,
    readonly apiKeyId?: string,
    readonly apiKeyName?: string
  ) {
    this.permissions = new Set(permissions);
  }

  static forUser(user: PrincipalUser): Principal {
    const role = UserRole.fromString(user.role);
    return new Principal('user', user, role, RolePolicy.permissionsOf(role));
  }

  static forApiKey(owner: PrincipalUser, key: { id: string; name: string; scopes: readonly string[] }): Principal {
    const role = UserRole.fromString(owner.role);
    const granted = RolePolicy.permissionsOf(role).filter(p => key.scopes.includes(p));
    return new Principal('api_key', owner, role, granted, key.id, key.name);
  }

  get userId(): string {
    return this.user.id;
  }

  isAdmin(): boolean {
    return this.role.isAdmin();
  }

  can(permission: Permission): boolean {
    return this.permissions.has(permission);
  }

  /** Owner-or-admin rule for resources a principal created (projects, keys, webhooks) */
  owns(ownerId: string | null | undefined): boolean {
    return this.isAdmin() || (!!ownerId && ownerId === this.user.id);
  }

  listPermissions(): Permission[] {
    return [...this.permissions];
  }

  /** Label stored in the audit log */
  label(): string {
    return this.kind === 'api_key' ? `${this.user.email} (key ${this.apiKeyName})` : this.user.email;
  }
}

/**
 * UserRole Value Object (Phase 5, Task 20)
 *
 * The role a human user holds. Agents are not users: they act inside the workflow engine
 * and their collaboration rights are governed by the ACL protocol (Phase 3), so the
 * original plan's `AGENT` user role was dropped.
 *
 * @pattern Value Object
 */
import { UserRoleName } from '@ai-corp/shared-types';

export class InvalidRoleError extends Error {
  constructor(value: string) {
    super(`Invalid role '${value}'. Valid roles: ${Object.values(UserRoleName).join(', ')}`);
    this.name = 'InvalidRoleError';
  }
}

export class UserRole {
  private constructor(readonly name: UserRoleName) {}

  static fromString(value: string): UserRole {
    const normalized = (value ?? '').toLowerCase().trim();
    const match = Object.values(UserRoleName).find(r => r === normalized);
    if (!match) throw new InvalidRoleError(value);
    return new UserRole(match);
  }

  static get ADMIN() { return new UserRole(UserRoleName.ADMIN); }
  static get BOARD_MEMBER() { return new UserRole(UserRoleName.BOARD_MEMBER); }
  static get VIEWER() { return new UserRole(UserRoleName.VIEWER); }

  isAdmin(): boolean {
    return this.name === UserRoleName.ADMIN;
  }

  equals(other: UserRole): boolean {
    return this.name === other.name;
  }

  toString(): string {
    return this.name;
  }
}

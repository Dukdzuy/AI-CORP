import { BadRequestException, ConflictException, Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { InvalidRoleError, Principal, RolePolicy, UserRole } from '../../domain/security';
import { AuditSnapshotRegistry } from '../audit/audit-snapshot.registry';

export interface UserView {
  id: string;
  email: string;
  name: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  permissions: string[];
}

/**
 * User & role management (Phase 5, Task 20 — UC-008).
 *
 * Invariants: an admin can't change their own role or deactivate themselves, and the
 * last active admin can't be demoted or deactivated, so the system can't lock itself out.
 */
@Injectable()
export class UserAdminService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService, private readonly snapshots: AuditSnapshotRegistry) {}

  onModuleInit() {
    this.snapshots.register('User', id => this.prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, role: true, isActive: true },
    }));
  }

  async list(): Promise<UserView[]> {
    const users = await this.prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
    return users.map(u => this.view(u));
  }

  async changeRole(actor: Principal, userId: string, role: string): Promise<UserView> {
    let next: UserRole;
    try {
      next = UserRole.fromString(role);
    } catch (e) {
      if (e instanceof InvalidRoleError) throw new BadRequestException(e.message);
      throw e;
    }
    const user = await this.load(userId);
    if (user.id === actor.userId) throw new ConflictException('You cannot change your own role');
    if (user.role === 'admin' && !next.isAdmin()) await this.assertAnotherActiveAdmin(user.id);

    const updated = await this.prisma.user.update({ where: { id: userId }, data: { role: next.name } });
    return this.view(updated);
  }

  async setActive(actor: Principal, userId: string, isActive: boolean): Promise<UserView> {
    const user = await this.load(userId);
    if (user.id === actor.userId && !isActive) throw new ConflictException('You cannot deactivate yourself');
    if (user.role === 'admin' && !isActive) await this.assertAnotherActiveAdmin(user.id);

    const updated = await this.prisma.user.update({ where: { id: userId }, data: { isActive } });
    if (!isActive) {
      // Revoking access also revokes the user's integration keys and silences their webhooks
      await this.prisma.apiKey.updateMany({ where: { ownerId: userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await this.prisma.webhook.updateMany({ where: { ownerId: userId }, data: { active: false } });
    }
    return this.view(updated);
  }

  roleMatrix() {
    return { permissions: RolePolicy.allPermissions(), roles: RolePolicy.matrix() };
  }

  private async load(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(`User ${userId} not found`);
    return user;
  }

  private async assertAnotherActiveAdmin(exceptId: string) {
    const others = await this.prisma.user.count({ where: { role: 'admin', isActive: true, id: { not: exceptId } } });
    if (others === 0) throw new ConflictException('At least one active admin must remain');
  }

  private view(u: { id: string; email: string; name: string; role: string; isActive: boolean; createdAt: Date }): UserView {
    let permissions: string[] = [];
    try {
      permissions = [...RolePolicy.permissionsOf(UserRole.fromString(u.role))];
    } catch {
      permissions = [];
    }
    return { id: u.id, email: u.email, name: u.name, role: u.role, isActive: u.isActive, createdAt: u.createdAt, permissions };
  }
}

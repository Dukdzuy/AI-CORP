import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditEntry, AuditLogFilter, AuditLogPage, IAuditLogRepository } from '../../domain/audit';
import { RepositoryException } from '../../domain/exceptions';

/**
 * Prisma implementation of the append-only audit log (Phase 5, Task 21)
 */
@Injectable()
export class PrismaAuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async append(entry: AuditEntry): Promise<void> {
    const e = entry.toPrimitives();
    try {
      await this.prisma.auditLog.create({
        data: {
          id: e.id,
          timestamp: e.timestamp,
          actorType: e.actor.type,
          userId: e.actor.userId ?? null,
          actorLabel: e.actor.label ?? null,
          apiKeyId: e.actor.apiKeyId ?? null,
          agentRole: e.actor.agentRole ?? null,
          action: e.action,
          resourceType: e.resourceType,
          resourceId: e.resourceId ?? null,
          projectId: e.projectId ?? null,
          changes: (e.changes ?? Prisma.JsonNull) as Prisma.InputJsonValue,
          ipAddress: e.ipAddress ?? null,
          userAgent: e.userAgent ?? null,
          success: e.success,
          errorMessage: e.errorMessage ?? null,
        },
      });
    } catch (error) {
      throw new RepositoryException('append', 'AuditLog', error as Error);
    }
  }

  async query(filter: AuditLogFilter, page: number, pageSize: number): Promise<AuditLogPage> {
    const where = this.where(filter);
    try {
      const [rows, total] = await Promise.all([
        this.prisma.auditLog.findMany({ where, orderBy: { timestamp: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }),
        this.prisma.auditLog.count({ where }),
      ]);
      return { items: rows.map(r => this.toEntity(r)), total, page, pageSize };
    } catch (error) {
      throw new RepositoryException('query', 'AuditLog', error as Error);
    }
  }

  async list(filter: AuditLogFilter, limit: number): Promise<AuditEntry[]> {
    try {
      const rows = await this.prisma.auditLog.findMany({ where: this.where(filter), orderBy: { timestamp: 'desc' }, take: limit });
      return rows.map(r => this.toEntity(r));
    } catch (error) {
      throw new RepositoryException('list', 'AuditLog', error as Error);
    }
  }

  private where(f: AuditLogFilter): Prisma.AuditLogWhereInput {
    const where: Prisma.AuditLogWhereInput = {};
    if (f.userId) where.userId = f.userId;
    if (f.action) {
      where.action = /[.*]$/.test(f.action) ? { startsWith: f.action.replace(/\*$/, '') } : f.action;
    }
    if (f.resourceType) where.resourceType = f.resourceType;
    if (f.resourceId) where.resourceId = f.resourceId;
    if (f.projectId) where.projectId = f.projectId;
    if (f.success !== undefined) where.success = f.success;
    if (f.from || f.to) where.timestamp = { ...(f.from ? { gte: f.from } : {}), ...(f.to ? { lte: f.to } : {}) };
    if (f.search) {
      where.OR = [
        { actorLabel: { contains: f.search, mode: 'insensitive' } },
        { action: { contains: f.search, mode: 'insensitive' } },
        { resourceId: { contains: f.search } },
      ];
    }
    return where;
  }

  private toEntity(r: Prisma.AuditLogGetPayload<{}>): AuditEntry {
    return AuditEntry.fromPersistence({
      id: r.id,
      timestamp: r.timestamp,
      actor: { type: r.actorType as any, userId: r.userId, label: r.actorLabel, apiKeyId: r.apiKeyId, agentRole: r.agentRole },
      action: r.action,
      resourceType: r.resourceType,
      resourceId: r.resourceId,
      projectId: r.projectId,
      changes: r.changes,
      ipAddress: r.ipAddress,
      userAgent: r.userAgent,
      success: r.success,
      errorMessage: r.errorMessage,
    });
  }
}

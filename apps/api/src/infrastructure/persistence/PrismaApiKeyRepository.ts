import { Injectable } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { PrismaService } from '../../prisma/prisma.service';
import { ApiKey, IApiKeyRepository } from '../../domain/integration';

/**
 * Prisma implementation of IApiKeyRepository (Phase 5, Task 22)
 */
@Injectable()
export class PrismaApiKeyRepository implements IApiKeyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(key: ApiKey): Promise<void> {
    const p = key.toPrimitives();
    await this.prisma.apiKey.upsert({
      where: { id: p.id },
      create: { ...p, scopes: [...p.scopes] },
      update: { name: p.name, scopes: [...p.scopes], expiresAt: p.expiresAt, lastUsedAt: p.lastUsedAt, revokedAt: p.revokedAt },
    });
  }

  async findById(id: string): Promise<ApiKey | null> {
    const row = await this.prisma.apiKey.findUnique({ where: { id } });
    return row ? ApiKey.fromPersistence({ ...row, scopes: row.scopes as Permission[] }) : null;
  }

  async findByOwner(ownerId: string | null): Promise<ApiKey[]> {
    const rows = await this.prisma.apiKey.findMany({
      where: ownerId ? { ownerId } : {},
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(row => ApiKey.fromPersistence({ ...row, scopes: row.scopes as Permission[] }));
  }

  async touch(id: string, at: Date): Promise<void> {
    await this.prisma.apiKey.update({ where: { id }, data: { lastUsedAt: at } });
  }
}

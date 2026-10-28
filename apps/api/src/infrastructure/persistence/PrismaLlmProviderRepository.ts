import { Injectable } from '@nestjs/common';
import { LlmProvider as LlmProviderRow, LlmModel as LlmModelRow } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ILlmProviderRepository, LlmProviderConfig, ModelSource, ProviderKind } from '../../domain/llm';

type Row = LlmProviderRow & { models: LlmModelRow[] };

/**
 * Prisma implementation of ILlmProviderRepository. A provider is saved with its models in
 * one transaction (the aggregate is the unit of consistency).
 */
@Injectable()
export class PrismaLlmProviderRepository implements ILlmProviderRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(provider: LlmProviderConfig): Promise<void> {
    const { provider: p, models } = provider.toPrimitives();
    const { id, createdAt, ...fields } = p;
    await this.prisma.$transaction([
      this.prisma.llmProvider.upsert({ where: { id }, create: p, update: fields }),
      this.prisma.llmModel.deleteMany({ where: { providerId: id, id: { notIn: models.map(m => m.id) } } }),
      ...models.map(({ id: modelId, ...m }) =>
        this.prisma.llmModel.upsert({
          where: { id: modelId },
          create: { id: modelId, providerId: id, ...m },
          update: { displayName: m.displayName, category: m.category, isEnabled: m.isEnabled },
        })
      ),
    ]);
  }

  async findById(id: string): Promise<LlmProviderConfig | null> {
    const row = await this.prisma.llmProvider.findUnique({ where: { id }, include: { models: { orderBy: { createdAt: 'asc' } } } });
    return row ? this.toDomain(row) : null;
  }

  async findByName(name: string): Promise<LlmProviderConfig | null> {
    const row = await this.prisma.llmProvider.findUnique({ where: { name }, include: { models: { orderBy: { createdAt: 'asc' } } } });
    return row ? this.toDomain(row) : null;
  }

  async findAll(): Promise<LlmProviderConfig[]> {
    const rows = await this.prisma.llmProvider.findMany({
      include: { models: { orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(r => this.toDomain(r));
  }

  async delete(id: string): Promise<void> {
    await this.prisma.llmProvider.delete({ where: { id } });
  }

  count(): Promise<number> {
    return this.prisma.llmProvider.count();
  }

  private toDomain(row: Row): LlmProviderConfig {
    const { models, ...provider } = row;
    return LlmProviderConfig.fromPersistence(
      { ...provider, kind: provider.kind as ProviderKind },
      models.map(({ providerId: _p, ...m }) => ({ ...m, source: m.source as ModelSource }))
    );
  }
}

import { Injectable } from '@nestjs/common';
import { WorkflowDefinition } from '@ai-corp/shared-types';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  IWorkflowDefinitionRepository,
  SaveDefinitionInput,
  WorkflowDefinitionVersionRecord,
} from './workflow-definition.repository';

@Injectable()
export class PrismaWorkflowDefinitionRepository implements IWorkflowDefinitionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async saveIfAbsent({ definition, templateId, parameters }: SaveDefinitionInput): Promise<void> {
    await this.prisma.workflowDefinitionVersion.upsert({
      where: { definitionId_version: { definitionId: definition.id, version: definition.version } },
      update: {},
      create: {
        definitionId: definition.id,
        version: definition.version,
        name: definition.name,
        definition: definition as any,
        templateId,
        parameters: parameters as any,
      },
    });
  }

  async findAll(): Promise<WorkflowDefinitionVersionRecord[]> {
    const rows = await this.prisma.workflowDefinitionVersion.findMany({ orderBy: { createdAt: 'asc' } });
    return rows.map(row => ({
      definitionId: row.definitionId,
      version: row.version,
      name: row.name,
      definition: row.definition as unknown as WorkflowDefinition,
      templateId: row.templateId,
      parameters: (row.parameters as Record<string, unknown> | null) ?? null,
      createdAt: row.createdAt,
    }));
  }
}

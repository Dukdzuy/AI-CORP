import { Injectable } from '@nestjs/common';
import {
  IAgentRepository,
  AgentDTO,
  CreateAgentData,
  UpdateAgentData,
} from '../../domain/repositories';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Prisma implementation of IAgentRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaAgentRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AgentDTO | null> {
    const agent = await this.prisma.agent.findUnique({ where: { id } });
    if (!agent) return null;
    return this.mapToDTO(agent);
  }

  async findByRole(role: string): Promise<AgentDTO | null> {
    const agent = await this.prisma.agent.findUnique({ where: { role } });
    if (!agent) return null;
    return this.mapToDTO(agent);
  }

  async findAll(options?: { onlyActive?: boolean }): Promise<AgentDTO[]> {
    const agents = await this.prisma.agent.findMany({
      where: options?.onlyActive ? { isActive: true } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    return agents.map((a) => this.mapToDTO(a));
  }

  async create(data: CreateAgentData): Promise<AgentDTO> {
    const agent = await this.prisma.agent.create({
      data: {
        role: data.role,
        name: data.name,
        systemPrompt: data.systemPrompt,
        modelRouteConfig: data.modelRouteConfig,
        isActive: data.isActive ?? true,
      },
    });
    return this.mapToDTO(agent);
  }

  async update(id: string, data: UpdateAgentData): Promise<AgentDTO> {
    const agent = await this.prisma.agent.update({
      where: { id },
      data,
    });
    return this.mapToDTO(agent);
  }

  async delete(id: string): Promise<void> {
    // Delete related records first
    await this.prisma.agentMemory.deleteMany({ where: { agentId: id } });
    await this.prisma.agentMessage.deleteMany({ where: { fromAgentId: id } });
    await this.prisma.agent.delete({ where: { id } });
  }

  private mapToDTO(agent: any): AgentDTO {
    return {
      id: agent.id,
      role: agent.role,
      name: agent.name,
      systemPrompt: agent.systemPrompt,
      modelRouteConfig: agent.modelRouteConfig,
      isActive: agent.isActive,
      createdAt: agent.createdAt,
      updatedAt: agent.updatedAt,
    };
  }
}

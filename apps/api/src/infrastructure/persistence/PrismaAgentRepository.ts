import { Injectable } from '@nestjs/common';
import {
  IAgentRepository,
  AgentDTO,
  CreateAgentData,
  UpdateAgentData,
} from '../../domain/repositories';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  EntityNotFoundException,
  RepositoryException,
  ForeignKeyViolationException,
  DatabaseConnectionException,
  UniqueConstraintViolationException,
} from '../../domain/exceptions';

/**
 * Prisma implementation of IAgentRepository
 * Infrastructure layer - depends on domain interfaces
 */
@Injectable()
export class PrismaAgentRepository implements IAgentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<AgentDTO | null> {
    try {
      const agent = await this.prisma.agent.findUnique({ where: { id } });
      if (!agent) return null;
      return this.mapToDTO(agent);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findById', 'Agent', error as Error);
    }
  }

  async findByRole(role: string): Promise<AgentDTO | null> {
    try {
      const agent = await this.prisma.agent.findUnique({ where: { role } });
      if (!agent) return null;
      return this.mapToDTO(agent);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findByRole', 'Agent', error as Error);
    }
  }

  async findAll(options?: { onlyActive?: boolean }): Promise<AgentDTO[]> {
    try {
      const agents = await this.prisma.agent.findMany({
        where: options?.onlyActive ? { isActive: true } : undefined,
        orderBy: { createdAt: 'asc' },
      });
      return agents.map((a) => this.mapToDTO(a));
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('findAll', 'Agent', error as Error);
    }
  }

  async create(data: CreateAgentData): Promise<AgentDTO> {
    try {
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2002') {
          throw new UniqueConstraintViolationException('Agent', 'role');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('create', 'Agent', error as Error);
    }
  }

  async update(id: string, data: UpdateAgentData): Promise<AgentDTO> {
    try {
      const agent = await this.prisma.agent.update({
        where: { id },
        data,
      });
      return this.mapToDTO(agent);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('Agent', id);
        }
        if (error.code === 'P2002') {
          throw new UniqueConstraintViolationException('Agent', 'role');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('update', 'Agent', error as Error);
    }
  }

  async delete(id: string): Promise<void> {
    try {
      // Delete related records first
      await this.prisma.agentMemory.deleteMany({ where: { agentId: id } });
      await this.prisma.agentMessage.deleteMany({ where: { fromAgentId: id } });
      await this.prisma.agent.delete({ where: { id } });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2025') {
          throw new EntityNotFoundException('Agent', id);
        }
        if (error.code === 'P2003') {
          throw new ForeignKeyViolationException('Agent', 'AgentMemory or AgentMessage');
        }
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('delete', 'Agent', error as Error);
    }
  }

  async exists(id: string): Promise<boolean> {
    try {
      const count = await this.prisma.agent.count({ where: { id } });
      return count > 0;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        if (error.code === 'P2021' || error.code === 'P2024') {
          throw new DatabaseConnectionException(error);
        }
      }
      throw new RepositoryException('exists', 'Agent', error as Error);
    }
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

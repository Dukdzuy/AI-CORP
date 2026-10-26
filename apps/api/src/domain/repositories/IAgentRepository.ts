/**
 * Agent Repository Interface
 *
 * The single persistence contract for agents (Repository Pattern).
 * Abstracts data access so the domain does not depend on Prisma,
 * and can be swapped for an in-memory implementation in tests.
 *
 * Follows Dependency Inversion Principle (SOLID)
 */

import { AgentRole } from '@ai-corp/shared-types';

export interface AgentDTO {
  id: string;
  role: string;
  name: string;
  systemPrompt: string;
  modelRouteConfig: any; // JSON
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAgentData {
  role: string;
  name: string;
  systemPrompt: string;
  modelRouteConfig: any;
  isActive?: boolean;
}

export interface UpdateAgentData {
  name?: string;
  systemPrompt?: string;
  modelRouteConfig?: any;
  isActive?: boolean;
}

/**
 * Repository interface for Agent aggregate
 */
export interface IAgentRepository {
  /**
   * Find agent by ID
   */
  findById(id: string): Promise<AgentDTO | null>;

  /**
   * Find agent by role (role is unique)
   */
  findByRole(role: AgentRole | string): Promise<AgentDTO | null>;

  /**
   * Find all agents
   */
  findAll(options?: { onlyActive?: boolean }): Promise<AgentDTO[]>;

  /**
   * Create a new agent
   */
  create(data: CreateAgentData): Promise<AgentDTO>;

  /**
   * Update an agent
   */
  update(id: string, data: UpdateAgentData): Promise<AgentDTO>;

  /**
   * Delete an agent
   */
  delete(id: string): Promise<void>;

  /**
   * Check whether an agent exists
   */
  exists(id: string): Promise<boolean>;
}

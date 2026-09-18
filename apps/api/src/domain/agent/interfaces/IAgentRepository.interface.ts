/**
 * IAgentRepository Interface
 * 
 * Repository interface for agent data persistence.
 * Implements the Repository Pattern for data access abstraction.
 * 
 * Design Pattern: **Repository Pattern**
 * - Abstracts data access logic
 * - Domain layer doesn't depend on specific ORM (Prisma)
 * - Easy to test with mock repositories
 * - Follows Dependency Inversion Principle
 * 
 * @module domain/agent/interfaces/IAgentRepository
 */

import { IAgent } from './IAgent.interface';
import { AgentRole } from '@ai-corp/shared-types';

/**
 * Agent Repository Interface
 * 
 * Provides data access methods for agents.
 * Concrete implementations handle database operations.
 * 
 * Responsibilities:
 * - CRUD operations for agents
 * - Query agents by various criteria
 * - Map between domain entities and database DTOs
 */
export interface IAgentRepository {
  /**
   * Find agent by unique ID
   * 
   * @param id - Agent ID
   * @returns Promise resolving to agent or null if not found
   */
  findById(id: string): Promise<IAgent | null>;

  /**
   * Find agent by role
   * 
   * Returns the first agent with the specified role.
   * Since each role should have one agent, this is typically unique.
   * 
   * @param role - Agent role
   * @returns Promise resolving to agent or null if not found
   */
  findByRole(role: AgentRole): Promise<IAgent | null>;

  /**
   * Get all agents
   * 
   * @returns Promise resolving to array of all agents
   */
  findAll(): Promise<IAgent[]>;

  /**
   * Save a new agent
   * 
   * Creates a new agent record in the database.
   * 
   * @param agent - Agent to save
   * @returns Promise resolving when save completes
   * @throws Error if agent with same ID already exists
   */
  save(agent: IAgent): Promise<void>;

  /**
   * Update an existing agent
   * 
   * Updates agent state, configuration, or other mutable properties.
   * 
   * @param agent - Agent with updated data
   * @returns Promise resolving when update completes
   * @throws Error if agent doesn't exist
   */
  update(agent: IAgent): Promise<void>;

  /**
   * Delete an agent
   * 
   * Removes agent from the database.
   * 
   * @param id - Agent ID to delete
   * @returns Promise resolving when deletion completes
   * @throws Error if agent doesn't exist
   */
  delete(id: string): Promise<void>;

  /**
   * Check if agent exists
   * 
   * @param id - Agent ID
   * @returns Promise resolving to true if agent exists
   */
  exists(id: string): Promise<boolean>;
}

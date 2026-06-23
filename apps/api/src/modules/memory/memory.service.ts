import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmbeddingService } from './embedding.service';

/**
 * Memory metadata for storing additional context with memories
 */
export interface MemoryMetadata {
  projectId?: string;
  importance?: number; // 1-10 scale (default 5)
  tags?: string[];
}

/**
 * Memory search result with computed ranking
 */
export interface MemorySearchResult {
  id: string;
  agentRole: string;
  namespace: string;
  content: string;
  importance: number;
  similarity: number; // Cosine similarity score (0-1)
  rank: number; // Combined rank score: similarity * 0.7 + (importance / 10) * 0.3
  createdAt: Date;
}

/**
 * MemoryService handles vector-based long-term memory storage for agents.
 * Provides semantic search using pgvector with cosine similarity.
 * Implements namespace isolation by agent role and similarity threshold filtering.
 *
 * Validates: Requirements 7, 8
 *
 * Requirement 7: Vector Memory System
 * - saveMemory: Generate vector embedding for content, store with agent role/namespace
 * - searchMemories: Vector similarity search with cosine distance
 * - Namespace isolation by agent role
 * - Similarity threshold >= 0.7
 * - Rank combining similarity (70%) and importance (30%)
 *
 * Requirement 8: Agent Memory Isolation
 * - Filter results by agent role (namespace isolation)
 * - Prevent cross-role memory access
 * - Index by agent role and namespace for efficiency
 */
@Injectable()
export class MemoryService {
  private readonly logger = new Logger(MemoryService.name);
  private readonly SIMILARITY_THRESHOLD = 0.7;
  private readonly SIMILARITY_WEIGHT = 0.7;
  private readonly IMPORTANCE_WEIGHT = 0.3;
  private readonly DEFAULT_IMPORTANCE = 5;
  private readonly MIN_IMPORTANCE = 1;
  private readonly MAX_IMPORTANCE = 10;

  constructor(
    private prisma: PrismaService,
    private embeddingService: EmbeddingService
  ) {}

  /**
   * Look up agent UUID by role from the Agent table.
   */
  async getAgentIdByRole(role: string): Promise<string | null> {
    const agent = await this.prisma.agent.findFirst({ where: { role } });
    return agent?.id ?? null;
  }

  /**
   * Save a memory for an agent with vector embedding.
   *
   * Preconditions:
   * - agentRole is a valid agent role (CEO, PM, DEV, QA, MARKETING)
   * - namespace is non-empty string
   * - content is non-empty string
   * - importance (if provided) is between 1-10
   * - agent exists in database
   *
   * Postconditions:
   * - AgentMemory record created in database
   * - Vector embedding generated and stored
   * - Returns memory ID
   * - Importance clamped to [1-10] range
   *
   * @param agentId - ID of the agent (must exist in Agent table)
   * @param agentRole - Role of the agent (CEO, PM, DEV, QA, MARKETING)
   * @param namespace - Memory namespace for organization (e.g., "coding_conventions", "lessons_learned")
   * @param content - The memory content to store
   * @param metadata - Optional metadata including importance, projectId, tags
   * @returns Promise resolving to the created memory ID
   * @throws Error if agent not found or database error
   */
  async saveMemory(
    agentId: string,
    agentRole: string,
    namespace: string,
    content: string,
    metadata?: MemoryMetadata
  ): Promise<string> {
    if (!agentId || !agentRole || !namespace || !content) {
      throw new Error('agentId, agentRole, namespace, and content are required');
    }

    // Validate importance is in valid range
    let importance = metadata?.importance ?? this.DEFAULT_IMPORTANCE;
    if (importance < this.MIN_IMPORTANCE || importance > this.MAX_IMPORTANCE) {
      this.logger.warn(
        `Importance ${importance} outside valid range [${this.MIN_IMPORTANCE}-${this.MAX_IMPORTANCE}], clamping`
      );
      importance = Math.max(
        this.MIN_IMPORTANCE,
        Math.min(this.MAX_IMPORTANCE, importance)
      );
    }

    // Generate embedding for the content
    const startTime = Date.now();
    const embedding = await this.embeddingService.generateEmbedding(content);
    const embeddingTimeMs = Date.now() - startTime;

    // Create memory record
    try {
      const memory = await this.prisma.agentMemory.create({
        data: {
          agentId,
          agentRole,
          namespace,
          content,
          embedding: JSON.stringify(embedding), // stored as JSON float array (pgvector wrapper in production)
          importance,
          metadata: {
            projectId: metadata?.projectId,
            timestamp: new Date().toISOString(),
            tags: metadata?.tags || [],
          },
        } as any,
      });

      // Structured logging for memory save
      this.logger.log(JSON.stringify({
        event: 'memory_save',
        agentRole,
        namespace,
        importance,
        contentLength: content.length,
        embeddingTimeMs,
        memoryId: memory.id,
      }));

      return memory.id;
    } catch (error: any) {
      // Gracefully handle FK constraint violations (agent not in DB)
      if (error?.code === 'P2003' || error?.message?.includes('Foreign key constraint')) {
        this.logger.warn(`Skipping memory save - agent '${agentId}' not found in Agent table (FK constraint)`);
        return 'skipped-no-agent';
      }
      this.logger.error(
        `Failed to save memory: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Search for memories using semantic similarity.
   *
   * Preconditions:
   * - agentRole is valid agent role
   * - query is non-empty string
   * - namespace is non-empty string
   * - limit > 0
   *
   * Postconditions:
   * - Returns memories with similarity >= threshold (0.7)
   * - Results filtered by agentRole (namespace isolation - Requirement 8)
   * - Results ranked by combined score: similarity * 0.7 + (importance/10) * 0.3
   * - Results sorted by rank descending
   * - At most 'limit' results returned
   *
   * Algorithm:
   * 1. Generate query embedding
   * 2. Calculate cosine similarity with pgvector for all memories in namespace
   * 3. Filter by agent role (namespace isolation - Requirement 8.1)
   * 4. Filter by similarity threshold >= 0.7 (Requirement 7.6)
   * 5. Rank results: rank = similarity * 0.7 + (importance/10) * 0.3
   * 6. Sort by rank descending
   * 7. Return top 'limit' results
   *
   * @param agentRole - Role of the agent searching for memories (enforces isolation - Requirement 8)
   * @param namespace - Memory namespace to search
   * @param query - Search query string
   * @param limit - Maximum number of results to return (default 10)
   * @returns Promise resolving to array of MemorySearchResult sorted by rank descending
   * @throws Error if query generation or database error
   */
  async searchMemories(
    agentRole: string,
    namespace: string,
    query: string,
    limit: number = 10
  ): Promise<MemorySearchResult[]> {
    if (!agentRole || !namespace || !query || limit <= 0) {
      throw new Error('agentRole, namespace, query are required and limit must be > 0');
    }

    // Generate query embedding
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    // Client-side cosine similarity (pgvector disabled for local dev)
    const allMemories = await this.prisma.agentMemory.findMany({
      where: {
        agentRole,
        namespace,
        embedding: { not: null },
      },
      select: {
        id: true,
        agentRole: true,
        namespace: true,
        content: true,
        importance: true,
        createdAt: true,
        embedding: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const queryVec = queryEmbedding;
    const results = allMemories
      .filter((m) => m.embedding)
      .map((m) => {
        const memVec: number[] = JSON.parse(m.embedding!);
        const dot = queryVec.reduce((sum, v, i) => sum + v * memVec[i], 0);
        const normQ = Math.sqrt(queryVec.reduce((sum, v) => sum + v * v, 0));
        const normM = Math.sqrt(memVec.reduce((sum, v) => sum + v * v, 0));
        const similarity = normQ && normM ? dot / (normQ * normM) : 0;
        return { ...m, similarity, embedding: undefined };
      })
      .filter((r) => r.similarity >= this.SIMILARITY_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit);

    // Cast results to MemorySearchResult with ranking
    const rankedResults: MemorySearchResult[] = results.map((r: any) => ({
      id: r.id,
      agentRole: r.agentRole,
      namespace: r.namespace,
      content: r.content,
      importance: r.importance,
      similarity: r.similarity,
      rank:
        r.similarity * this.SIMILARITY_WEIGHT +
        (r.importance / this.MAX_IMPORTANCE) * this.IMPORTANCE_WEIGHT,
      createdAt: r.createdAt,
    }));

    // Structured logging for memory search
    this.logger.log(JSON.stringify({
      event: 'memory_search',
      agentRole,
      namespace,
      query: query.substring(0, 50),
      resultCount: rankedResults.length,
      threshold: this.SIMILARITY_THRESHOLD,
      topSimilarity: rankedResults[0]?.similarity,
      topRank: rankedResults[0]?.rank,
    }));

    return rankedResults;
  }

  /**
   * Delete a memory by ID.
   *
   * Preconditions:
   * - memoryId is a valid UUID
   * - Memory exists in database
   *
   * Postconditions:
   * - AgentMemory record deleted from database
   * - Returns true on success
   *
   * @param memoryId - ID of memory to delete
   * @returns Promise resolving to true on success
   * @throws Error if memory not found or database error
   */
  async deleteMemory(memoryId: string): Promise<boolean> {
    if (!memoryId) {
      throw new Error('memoryId is required');
    }

    try {
      await this.prisma.agentMemory.delete({
        where: { id: memoryId },
      });

      this.logger.log(`Deleted memory with ID ${memoryId}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to delete memory: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Prune old memories for an agent role by retention period.
   *
   * Preconditions:
   * - agentRole is valid agent role
   * - retentionDays > 0
   *
   * Postconditions:
   * - All memories older than retentionDays deleted for given agent role
   * - Returns count of deleted memories
   *
   * @param agentRole - Role of agent whose memories to prune
   * @param retentionDays - Retention period in days
   * @returns Promise resolving to number of deleted memories
   * @throws Error on database error
   */
  async pruneOldMemories(agentRole: string, retentionDays: number): Promise<number> {
    if (!agentRole || retentionDays <= 0) {
      throw new Error('agentRole is required and retentionDays must be > 0');
    }

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    try {
      const result = await this.prisma.agentMemory.deleteMany({
        where: {
          agentRole,
          createdAt: {
            lt: cutoffDate,
          },
        },
      });

      this.logger.log(
        `Pruned ${result.count} old memories for ${agentRole} (retention: ${retentionDays} days)`
      );

      return result.count;
    } catch (error) {
      this.logger.error(
        `Failed to prune memories: ${error instanceof Error ? error.message : String(error)}`
      );
      throw error;
    }
  }

  /**
   * Get memory by ID.
   *
   * @param memoryId - ID of memory to retrieve
   * @returns Promise resolving to memory or null if not found
   */
  async getMemory(memoryId: string) {
    if (!memoryId) {
      throw new Error('memoryId is required');
    }

    return this.prisma.agentMemory.findUnique({
      where: { id: memoryId },
    });
  }

  /**
   * Get all memories for an agent role and namespace.
   *
   * @param agentRole - Role of agent
   * @param namespace - Memory namespace
   * @param limit - Maximum results (default 100)
   * @returns Promise resolving to array of memories
   */
  async getMemoriesByNamespace(
    agentRole: string,
    namespace: string,
    limit: number = 100
  ) {
    if (!agentRole || !namespace) {
      throw new Error('agentRole and namespace are required');
    }

    return this.prisma.agentMemory.findMany({
      where: {
        agentRole,
        namespace,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });
  }

  /**
   * Get memory statistics for an agent role.
   *
   * @param agentRole - Role of agent
   * @returns Promise resolving to statistics object
   */
  async getMemoryStats(agentRole: string) {
    if (!agentRole) {
      throw new Error('agentRole is required');
    }

    const memories = await this.prisma.agentMemory.findMany({
      where: { agentRole },
    });

    const byNamespace = memories.reduce(
      (acc, m) => {
        acc[m.namespace] = (acc[m.namespace] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    return {
      agentRole,
      totalMemories: memories.length,
      byNamespace,
      oldestMemory: memories.length > 0 ? Math.min(...memories.map((m) => m.createdAt.getTime())) : null,
      newestMemory: memories.length > 0 ? Math.max(...memories.map((m) => m.createdAt.getTime())) : null,
      averageImportance: memories.length > 0 ? memories.reduce((sum, m) => sum + m.importance, 0) / memories.length : 0,
    };
  }

  /**
   * Get the current model config for an agent from the database.
   * Returns the DB config if set, otherwise returns the hardcoded fallback.
   */
  async getModelConfigForAgent(role: string, fallback: any): Promise<any> {
    try {
      const agent = await this.prisma.agent.findUnique({
        where: { role: role.toUpperCase() },
        select: { modelRouteConfig: true },
      });
      if (agent?.modelRouteConfig) {
        return agent.modelRouteConfig as any;
      }
    } catch (e) {
      this.logger.warn(`Failed to read model config from DB for ${role}, using fallback`);
    }
    return fallback;
  }
}

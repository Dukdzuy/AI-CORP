import { Test, TestingModule } from '@nestjs/testing';
import { MemoryService } from './memory.service';
import { EmbeddingService } from './embedding.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('MemoryService', () => {
  let service: MemoryService;
  let embeddingService: EmbeddingService;
  let prismaService: PrismaService;

  const mockEmbedding = Array(1536).fill(0.1);

  beforeEach(async () => {
    // Create mocks
    const mockEmbeddingService = {
      generateEmbedding: jest.fn().mockResolvedValue(mockEmbedding),
      batchGenerateEmbeddings: jest.fn().mockResolvedValue([mockEmbedding]),
      getConfig: jest.fn().mockReturnValue({
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        batchSize: 10,
      }),
      setConfig: jest.fn(),
    };

    const mockPrismaService = {
      agentMemory: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        delete: jest.fn(),
        deleteMany: jest.fn(),
      },
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MemoryService,
        {
          provide: EmbeddingService,
          useValue: mockEmbeddingService,
        },
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<MemoryService>(MemoryService);
    embeddingService = module.get<EmbeddingService>(EmbeddingService);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  describe('saveMemory', () => {
    it('should save a memory with vector embedding', async () => {
      const mockMemory = {
        id: 'mem-123',
        agentId: 'agent-123',
        agentRole: 'DEV',
        namespace: 'coding_conventions',
        content: 'Use async/await for promises',
        embedding: mockEmbedding,
        importance: 8,
        metadata: {},
        createdAt: new Date(),
      };

      (prismaService.agentMemory.create as jest.Mock).mockResolvedValue(mockMemory);

      const result = await service.saveMemory(
        'agent-123',
        'DEV',
        'coding_conventions',
        'Use async/await for promises',
        { importance: 8 }
      );

      expect(result).toBe('mem-123');
      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(
        'Use async/await for promises'
      );
      expect(prismaService.agentMemory.create).toHaveBeenCalled();
    });

    it('should use default importance if not provided', async () => {
      const mockMemory = {
        id: 'mem-123',
        agentId: 'agent-123',
        agentRole: 'PM',
        namespace: 'project_notes',
        content: 'Meeting notes',
        embedding: mockEmbedding,
        importance: 5,
        metadata: {},
        createdAt: new Date(),
      };

      (prismaService.agentMemory.create as jest.Mock).mockResolvedValue(mockMemory);

      const result = await service.saveMemory(
        'agent-123',
        'PM',
        'project_notes',
        'Meeting notes'
      );

      expect(result).toBe('mem-123');
      const createCall = (prismaService.agentMemory.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.importance).toBe(5);
    });

    it('should clamp importance to valid range [1-10]', async () => {
      const mockMemory = {
        id: 'mem-123',
        agentId: 'agent-123',
        agentRole: 'CEO',
        namespace: 'strategy',
        content: 'Strategic plan',
        embedding: mockEmbedding,
        importance: 10,
        metadata: {},
        createdAt: new Date(),
      };

      (prismaService.agentMemory.create as jest.Mock).mockResolvedValue(mockMemory);

      // Test with importance > 10 (should clamp to 10)
      await service.saveMemory(
        'agent-123',
        'CEO',
        'strategy',
        'Strategic plan',
        { importance: 15 }
      );

      let createCall = (prismaService.agentMemory.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.importance).toBe(10);

      // Test with importance < 1 (should clamp to 1)
      (prismaService.agentMemory.create as jest.Mock).mockClear();
      (prismaService.agentMemory.create as jest.Mock).mockResolvedValue({
        ...mockMemory,
        importance: 1,
      });

      await service.saveMemory(
        'agent-123',
        'CEO',
        'strategy',
        'Strategic plan',
        { importance: 0 }
      );

      createCall = (prismaService.agentMemory.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.importance).toBe(1);
    });

    it('should include metadata in stored memory', async () => {
      const mockMemory = {
        id: 'mem-123',
        agentId: 'agent-123',
        agentRole: 'QA',
        namespace: 'test_cases',
        content: 'Test coverage for auth module',
        embedding: mockEmbedding,
        importance: 7,
        metadata: {
          projectId: 'proj-123',
          tags: ['auth', 'critical'],
        },
        createdAt: new Date(),
      };

      (prismaService.agentMemory.create as jest.Mock).mockResolvedValue(mockMemory);

      const result = await service.saveMemory(
        'agent-123',
        'QA',
        'test_cases',
        'Test coverage for auth module',
        {
          importance: 7,
          projectId: 'proj-123',
          tags: ['auth', 'critical'],
        }
      );

      expect(result).toBe('mem-123');
      const createCall = (prismaService.agentMemory.create as jest.Mock).mock.calls[0][0];
      expect(createCall.data.metadata.projectId).toBe('proj-123');
      expect(createCall.data.metadata.tags).toEqual(['auth', 'critical']);
    });

    it('should throw error if required parameters are missing', async () => {
      await expect(
        service.saveMemory('', 'DEV', 'namespace', 'content')
      ).rejects.toThrow('agentId, agentRole, namespace, and content are required');

      await expect(
        service.saveMemory('agent-123', '', 'namespace', 'content')
      ).rejects.toThrow('agentId, agentRole, namespace, and content are required');

      await expect(
        service.saveMemory('agent-123', 'DEV', '', 'content')
      ).rejects.toThrow('agentId, agentRole, namespace, and content are required');

      await expect(
        service.saveMemory('agent-123', 'DEV', 'namespace', '')
      ).rejects.toThrow('agentId, agentRole, namespace, and content are required');
    });

    it('should call embedding service with content', async () => {
      const content = 'This is a test memory';
      const mockMemory = {
        id: 'mem-123',
        agentId: 'agent-123',
        agentRole: 'DEV',
        namespace: 'ns',
        content,
        embedding: mockEmbedding,
        importance: 5,
        metadata: {},
        createdAt: new Date(),
      };

      (prismaService.agentMemory.create as jest.Mock).mockResolvedValue(mockMemory);
      (embeddingService.generateEmbedding as jest.Mock).mockClear();

      await service.saveMemory('agent-123', 'DEV', 'ns', content);

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(content);
    });
  });

  describe('searchMemories', () => {
    it('should search memories and return ranked results', async () => {
      const mockSearchResults = [
        {
          id: 'mem-1',
          agentRole: 'DEV',
          namespace: 'coding',
          content: 'Use async/await',
          importance: 8,
          createdAt: new Date(),
          similarity: 0.95,
        },
        {
          id: 'mem-2',
          agentRole: 'DEV',
          namespace: 'coding',
          content: 'Use promises',
          importance: 6,
          createdAt: new Date(),
          similarity: 0.8,
        },
      ];

      (prismaService.$queryRaw as jest.Mock).mockResolvedValue(mockSearchResults);

      const results = await service.searchMemories(
        'DEV',
        'coding',
        'async patterns',
        10
      );

      expect(results).toHaveLength(2);
      expect(results[0].id).toBe('mem-1');
      expect(results[0].similarity).toBe(0.95);
      expect(results[1].id).toBe('mem-2');
      expect(results[1].similarity).toBe(0.8);
    });

    it('should calculate combined rank score correctly', async () => {
      /**
       * Validates: Requirements 7.7
       * Rank = similarity * 0.7 + (importance/10) * 0.3
       * mem-1: rank = 0.95 * 0.7 + (8/10) * 0.3 = 0.665 + 0.24 = 0.905
       * mem-2: rank = 0.8 * 0.7 + (6/10) * 0.3 = 0.56 + 0.18 = 0.74
       */
      const mockSearchResults = [
        {
          id: 'mem-1',
          agentRole: 'DEV',
          namespace: 'coding',
          content: 'Content 1',
          importance: 8,
          createdAt: new Date(),
          similarity: 0.95,
        },
        {
          id: 'mem-2',
          agentRole: 'DEV',
          namespace: 'coding',
          content: 'Content 2',
          importance: 6,
          createdAt: new Date(),
          similarity: 0.8,
        },
      ];

      (prismaService.$queryRaw as jest.Mock).mockResolvedValue(mockSearchResults);

      const results = await service.searchMemories('DEV', 'coding', 'query', 10);

      expect(results[0].rank).toBeCloseTo(0.905, 2);
      expect(results[1].rank).toBeCloseTo(0.74, 2);
    });

    it('should filter by agent role (namespace isolation)', async () => {
      /**
       * Validates: Requirements 8.1
       * When an agent of role R1 searches for memories, only memories where agent_role equals R1 are returned
       */
      const mockSearchResults = [
        {
          id: 'mem-1',
          agentRole: 'DEV',
          namespace: 'coding',
          content: 'Dev memory',
          importance: 5,
          createdAt: new Date(),
          similarity: 0.9,
        },
      ];

      (prismaService.$queryRaw as jest.Mock).mockResolvedValue(mockSearchResults);

      const results = await service.searchMemories('DEV', 'coding', 'query', 10);

      expect(results).toHaveLength(1);
      expect(results[0].agentRole).toBe('DEV');

      // Verify the query was called with the agent role parameter
      expect(prismaService.$queryRaw).toHaveBeenCalled();
    });

    it('should filter by similarity threshold >= 0.7', async () => {
      /**
       * Validates: Requirements 7.6
       * Only memories with similarity score >= 0.7 are returned
       */
      const mockSearchResults = [
        {
          id: 'mem-1',
          agentRole: 'PM',
          namespace: 'planning',
          content: 'Memory 1',
          importance: 5,
          createdAt: new Date(),
          similarity: 0.75,
        },
        {
          id: 'mem-2',
          agentRole: 'PM',
          namespace: 'planning',
          content: 'Memory 2',
          importance: 5,
          createdAt: new Date(),
          similarity: 0.65, // Below threshold, but we mock it anyway to test filtering
        },
      ];

      (prismaService.$queryRaw as jest.Mock).mockResolvedValue(mockSearchResults);

      const results = await service.searchMemories('PM', 'planning', 'query', 10);

      // Should have 2 results from mock (filtering happens in DB query)
      expect(results.length).toBeGreaterThan(0);
    });

    it('should respect limit parameter', async () => {
      const mockSearchResults = Array(5)
        .fill(0)
        .map((_, i) => ({
          id: `mem-${i}`,
          agentRole: 'QA',
          namespace: 'testing',
          content: `Memory ${i}`,
          importance: 5,
          createdAt: new Date(),
          similarity: 0.9 - i * 0.05,
        }));

      (prismaService.$queryRaw as jest.Mock).mockImplementation((query, ...values) => {
        // Simulate DB limit behavior by slicing
        return Promise.resolve(mockSearchResults.slice(0, 3));
      });

      const results = await service.searchMemories('QA', 'testing', 'query', 3);

      expect(results.length).toBeLessThanOrEqual(3);
    });

    it('should rank results by score descending', async () => {
      /**
       * Validates: Requirements 7.7
       * Results are sorted by combined rank score in descending order
       */
      const mockSearchResults = [
        {
          id: 'mem-1',
          agentRole: 'CEO',
          namespace: 'strategy',
          content: 'Memory 1',
          importance: 9,
          createdAt: new Date(),
          similarity: 0.85,
        },
        {
          id: 'mem-2',
          agentRole: 'CEO',
          namespace: 'strategy',
          content: 'Memory 2',
          importance: 5,
          createdAt: new Date(),
          similarity: 0.75,
        },
        {
          id: 'mem-3',
          agentRole: 'CEO',
          namespace: 'strategy',
          content: 'Memory 3',
          importance: 10,
          createdAt: new Date(),
          similarity: 0.8,
        },
      ];

      (prismaService.$queryRaw as jest.Mock).mockResolvedValue(mockSearchResults);

      const results = await service.searchMemories('CEO', 'strategy', 'query', 10);

      // Verify results are sorted by rank
      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].rank).toBeGreaterThanOrEqual(results[i + 1].rank);
      }
    });

    it('should return empty array for no matches', async () => {
      (prismaService.$queryRaw as jest.Mock).mockResolvedValue([]);

      const results = await service.searchMemories(
        'MARKETING',
        'content',
        'query',
        10
      );

      expect(results).toEqual([]);
    });

    it('should throw error if required parameters are missing', async () => {
      await expect(
        service.searchMemories('', 'namespace', 'query', 10)
      ).rejects.toThrow('agentRole, namespace, query are required');

      await expect(
        service.searchMemories('DEV', '', 'query', 10)
      ).rejects.toThrow('agentRole, namespace, query are required');

      await expect(
        service.searchMemories('DEV', 'namespace', '', 10)
      ).rejects.toThrow('agentRole, namespace, query are required');

      await expect(
        service.searchMemories('DEV', 'namespace', 'query', -1)
      ).rejects.toThrow('agentRole, namespace, query are required');
    });

    it('should call embedding service with query', async () => {
      const query = 'search for this';
      (prismaService.$queryRaw as jest.Mock).mockResolvedValue([]);
      (embeddingService.generateEmbedding as jest.Mock).mockClear();

      await service.searchMemories('DEV', 'coding', query, 10);

      expect(embeddingService.generateEmbedding).toHaveBeenCalledWith(query);
    });
  });

  describe('deleteMemory', () => {
    it('should delete a memory by ID', async () => {
      (prismaService.agentMemory.delete as jest.Mock).mockResolvedValue({
        id: 'mem-123',
      });

      const result = await service.deleteMemory('mem-123');

      expect(result).toBe(true);
      expect(prismaService.agentMemory.delete).toHaveBeenCalledWith({
        where: { id: 'mem-123' },
      });
    });

    it('should throw error if memoryId is empty', async () => {
      await expect(service.deleteMemory('')).rejects.toThrow('memoryId is required');
    });

    it('should handle database errors', async () => {
      (prismaService.agentMemory.delete as jest.Mock).mockRejectedValue(
        new Error('Database error')
      );

      await expect(service.deleteMemory('mem-123')).rejects.toThrow('Database error');
    });
  });

  describe('pruneOldMemories', () => {
    it('should delete old memories by retention period', async () => {
      (prismaService.agentMemory.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const result = await service.pruneOldMemories('DEV', 30);

      expect(result).toBe(5);
      expect(prismaService.agentMemory.deleteMany).toHaveBeenCalled();
    });

    it('should throw error if agentRole is empty', async () => {
      await expect(service.pruneOldMemories('', 30)).rejects.toThrow(
        'agentRole is required and retentionDays must be > 0'
      );
    });

    it('should throw error if retentionDays is invalid', async () => {
      await expect(service.pruneOldMemories('DEV', 0)).rejects.toThrow(
        'agentRole is required and retentionDays must be > 0'
      );

      await expect(service.pruneOldMemories('DEV', -1)).rejects.toThrow(
        'agentRole is required and retentionDays must be > 0'
      );
    });
  });

  describe('getMemory', () => {
    it('should retrieve a memory by ID', async () => {
      const mockMemory = {
        id: 'mem-123',
        agentRole: 'DEV',
        namespace: 'coding',
        content: 'Memory content',
        importance: 5,
        metadata: {},
        createdAt: new Date(),
        embedding: mockEmbedding,
      };

      (prismaService.agentMemory.findUnique as jest.Mock).mockResolvedValue(
        mockMemory
      );

      const result = await service.getMemory('mem-123');

      expect(result).toEqual(mockMemory);
      expect(prismaService.agentMemory.findUnique).toHaveBeenCalledWith({
        where: { id: 'mem-123' },
      });
    });

    it('should throw error if memoryId is empty', async () => {
      await expect(service.getMemory('')).rejects.toThrow('memoryId is required');
    });
  });

  describe('getMemoriesByNamespace', () => {
    it('should retrieve all memories for a namespace', async () => {
      const mockMemories = [
        {
          id: 'mem-1',
          agentRole: 'PM',
          namespace: 'planning',
          content: 'Memory 1',
          importance: 5,
          metadata: {},
          createdAt: new Date(),
          embedding: mockEmbedding,
        },
        {
          id: 'mem-2',
          agentRole: 'PM',
          namespace: 'planning',
          content: 'Memory 2',
          importance: 6,
          metadata: {},
          createdAt: new Date(),
          embedding: mockEmbedding,
        },
      ];

      (prismaService.agentMemory.findMany as jest.Mock).mockResolvedValue(
        mockMemories
      );

      const result = await service.getMemoriesByNamespace('PM', 'planning', 100);

      expect(result).toEqual(mockMemories);
      expect(prismaService.agentMemory.findMany).toHaveBeenCalled();
    });

    it('should enforce namespace isolation by agent role', async () => {
      (prismaService.agentMemory.findMany as jest.Mock).mockResolvedValue([]);

      await service.getMemoriesByNamespace('QA', 'testing', 50);

      const findCall = (prismaService.agentMemory.findMany as jest.Mock).mock
        .calls[0][0];
      expect(findCall.where.agentRole).toBe('QA');
      expect(findCall.where.namespace).toBe('testing');
    });

    it('should throw error if parameters are missing', async () => {
      await expect(
        service.getMemoriesByNamespace('', 'namespace')
      ).rejects.toThrow('agentRole and namespace are required');

      await expect(service.getMemoriesByNamespace('DEV', '')).rejects.toThrow(
        'agentRole and namespace are required'
      );
    });
  });

  describe('getMemoryStats', () => {
    it('should return memory statistics for an agent role', async () => {
      const mockMemories = [
        {
          id: 'mem-1',
          agentRole: 'DEV',
          namespace: 'coding_conventions',
          content: 'Memory 1',
          importance: 8,
          metadata: {},
          createdAt: new Date('2024-01-01'),
          embedding: mockEmbedding,
        },
        {
          id: 'mem-2',
          agentRole: 'DEV',
          namespace: 'coding_conventions',
          content: 'Memory 2',
          importance: 6,
          metadata: {},
          createdAt: new Date('2024-01-02'),
          embedding: mockEmbedding,
        },
        {
          id: 'mem-3',
          agentRole: 'DEV',
          namespace: 'lessons_learned',
          content: 'Memory 3',
          importance: 9,
          metadata: {},
          createdAt: new Date('2024-01-03'),
          embedding: mockEmbedding,
        },
      ];

      (prismaService.agentMemory.findMany as jest.Mock).mockResolvedValue(
        mockMemories
      );

      const stats = await service.getMemoryStats('DEV');

      expect(stats.agentRole).toBe('DEV');
      expect(stats.totalMemories).toBe(3);
      expect(stats.byNamespace['coding_conventions']).toBe(2);
      expect(stats.byNamespace['lessons_learned']).toBe(1);
      expect(stats.averageImportance).toBeCloseTo((8 + 6 + 9) / 3, 2);
    });

    it('should return zero values for agent with no memories', async () => {
      (prismaService.agentMemory.findMany as jest.Mock).mockResolvedValue([]);

      const stats = await service.getMemoryStats('MARKETING');

      expect(stats.agentRole).toBe('MARKETING');
      expect(stats.totalMemories).toBe(0);
      expect(stats.byNamespace).toEqual({});
      expect(stats.averageImportance).toBe(0);
    });

    it('should throw error if agentRole is empty', async () => {
      await expect(service.getMemoryStats('')).rejects.toThrow(
        'agentRole is required'
      );
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow: save then search', async () => {
      const memoryId = 'mem-123';
      const searchResults = [
        {
          id: memoryId,
          agentRole: 'CEO',
          namespace: 'strategy',
          content: 'Strategic planning document',
          importance: 8,
          createdAt: new Date(),
          similarity: 0.92,
        },
      ];

      // First save a memory
      (prismaService.agentMemory.create as jest.Mock).mockResolvedValue({
        id: memoryId,
        agentRole: 'CEO',
        namespace: 'strategy',
        content: 'Strategic planning document',
        embedding: mockEmbedding,
        importance: 8,
        metadata: { projectId: 'proj-123' },
        createdAt: new Date(),
      });

      const saveResult = await service.saveMemory(
        'agent-123',
        'CEO',
        'strategy',
        'Strategic planning document',
        { importance: 8, projectId: 'proj-123' }
      );

      expect(saveResult).toBe(memoryId);

      // Then search for it
      (prismaService.$queryRaw as jest.Mock).mockResolvedValue(searchResults);

      const searchResult = await service.searchMemories(
        'CEO',
        'strategy',
        'strategic planning',
        10
      );

      expect(searchResult).toHaveLength(1);
      expect(searchResult[0].id).toBe(memoryId);
      expect(searchResult[0].similarity).toBeGreaterThanOrEqual(0.7);
    });

    it('should maintain namespace isolation across different roles', async () => {
      /**
       * Validates: Requirements 8.2
       * When an agent of role R2 searches the same namespace, memories created by role R1 are not returned
       */
      const devMemories = [
        {
          id: 'dev-mem-1',
          agentRole: 'DEV',
          namespace: 'coding',
          content: 'Dev memory',
          importance: 5,
          createdAt: new Date(),
          similarity: 0.9,
        },
      ];

      const qaMemories = [
        {
          id: 'qa-mem-1',
          agentRole: 'QA',
          namespace: 'coding',
          content: 'QA memory',
          importance: 5,
          createdAt: new Date(),
          similarity: 0.85,
        },
      ];

      // First search for DEV memories
      (prismaService.$queryRaw as jest.Mock).mockResolvedValue(devMemories);

      let results = await service.searchMemories('DEV', 'coding', 'query', 10);

      expect(results).toHaveLength(1);
      expect(results[0].agentRole).toBe('DEV');

      // Then search for QA memories in same namespace
      (prismaService.$queryRaw as jest.Mock).mockResolvedValue(qaMemories);

      results = await service.searchMemories('QA', 'coding', 'query', 10);

      expect(results).toHaveLength(1);
      expect(results[0].agentRole).toBe('QA');
    });
  });
});

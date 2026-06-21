import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { EmbeddingService } from './embedding.service';
import OpenAI from 'openai';

// Mock OpenAI module
jest.mock('openai');

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let configService: ConfigService;
  let mockOpenAIClient: jest.Mocked<OpenAI>;

  beforeEach(async () => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Create mock config service
    const mockConfigService = {
      get: jest.fn((key: string) => {
        const config: Record<string, any> = {
          EMBEDDING_PROVIDER: 'openai',
          EMBEDDING_MODEL: 'text-embedding-3-small',
          EMBEDDING_DIMENSIONS: 1536,
          EMBEDDING_BATCH_SIZE: 10,
          OPENAI_API_KEY: 'test-api-key',
        };
        return config[key];
      }),
    };

    // Create mock OpenAI client
    mockOpenAIClient = {
      embeddings: {
        create: jest.fn(),
      },
    } as any;

    // Mock the OpenAI constructor
    (OpenAI as jest.MockedClass<typeof OpenAI>).mockImplementation(
      () => mockOpenAIClient
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('initialization', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should initialize with default configuration', () => {
      const config = service.getConfig();
      expect(config.provider).toBe('openai');
      expect(config.model).toBe('text-embedding-3-small');
      expect(config.dimensions).toBe(1536);
      expect(config.batchSize).toBe(10);
    });

    it('should throw error if OPENAI_API_KEY is not set', () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);
      expect(() => {
        // This will be called during initialization
        // We need to create a new instance to trigger the error
        new EmbeddingService(configService);
      }).toThrow('OPENAI_API_KEY environment variable is not set');
    });
  });

  describe('generateEmbedding', () => {
    it('should generate embedding for valid text', async () => {
      const mockEmbedding = Array(1536).fill(0.1);
      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: [{ embedding: mockEmbedding, index: 0 }],
      });

      const result = await service.generateEmbedding('test text');

      expect(result).toEqual(mockEmbedding);
      expect(result.length).toBe(1536);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledWith({
        model: 'text-embedding-3-small',
        input: 'test text',
        dimensions: 1536,
      });
    });

    it('should handle empty text by returning zero vector', async () => {
      const result = await service.generateEmbedding('');

      expect(result).toHaveLength(1536);
      expect(result.every((val) => val === 0)).toBe(true);
      expect(mockOpenAIClient.embeddings.create).not.toHaveBeenCalled();
    });

    it('should handle whitespace-only text by returning zero vector', async () => {
      const result = await service.generateEmbedding('   ');

      expect(result).toHaveLength(1536);
      expect(result.every((val) => val === 0)).toBe(true);
      expect(mockOpenAIClient.embeddings.create).not.toHaveBeenCalled();
    });

    it('should return zero vector on API error', async () => {
      (mockOpenAIClient.embeddings.create as jest.Mock).mockRejectedValue(
        new Error('API Error')
      );

      const result = await service.generateEmbedding('test text');

      expect(result).toHaveLength(1536);
      expect(result.every((val) => val === 0)).toBe(true);
    });

    it('should return zero vector if no embedding data is returned', async () => {
      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: [],
      });

      const result = await service.generateEmbedding('test text');

      expect(result).toHaveLength(1536);
      expect(result.every((val) => val === 0)).toBe(true);
    });

    it('should return zero vector if embedding is empty', async () => {
      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: [{ embedding: [], index: 0 }],
      });

      const result = await service.generateEmbedding('test text');

      expect(result).toHaveLength(1536);
      expect(result.every((val) => val === 0)).toBe(true);
    });

    it('should generate embedding with varying text lengths', async () => {
      const shortText = 'a';
      const longText = 'a'.repeat(1000);
      const mockEmbedding = Array(1536).fill(0.2);

      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: [{ embedding: mockEmbedding, index: 0 }],
      });

      const shortResult = await service.generateEmbedding(shortText);
      expect(shortResult).toEqual(mockEmbedding);

      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: [{ embedding: mockEmbedding, index: 0 }],
      });

      const longResult = await service.generateEmbedding(longText);
      expect(longResult).toEqual(mockEmbedding);
    });
  });

  describe('batchGenerateEmbeddings', () => {
    it('should generate embeddings for multiple texts', async () => {
      const texts = ['text 1', 'text 2', 'text 3'];
      const mockEmbeddings = texts.map((_, idx) =>
        Object.assign(Array(1536).fill(0.1), { index: idx })
      );

      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: mockEmbeddings,
      });

      const results = await service.batchGenerateEmbeddings(texts);

      expect(results).toHaveLength(3);
      expect(results[0]).toHaveLength(1536);
      expect(results[1]).toHaveLength(1536);
      expect(results[2]).toHaveLength(1536);
    });

    it('should handle empty array', async () => {
      const results = await service.batchGenerateEmbeddings([]);

      expect(results).toEqual([]);
      expect(mockOpenAIClient.embeddings.create).not.toHaveBeenCalled();
    });

    it('should process texts in batches', async () => {
      const texts = Array(25).fill(0).map((_, i) => `text ${i}`);
      const mockEmbeddings = texts.map((_, idx) =>
        Object.assign(Array(1536).fill(0.1), { index: idx % 10 })
      );

      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: mockEmbeddings.slice(0, 10),
      });

      const results = await service.batchGenerateEmbeddings(texts);

      expect(results).toHaveLength(25);
      // Should be called 3 times for 25 texts with batch size 10
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed empty and non-empty texts', async () => {
      const texts = ['text 1', '', 'text 3', '   ', 'text 5'];
      const mockEmbeddings = [
        { embedding: Array(1536).fill(0.1), index: 0 },
        { embedding: Array(1536).fill(0.1), index: 1 },
        { embedding: Array(1536).fill(0.1), index: 2 },
        { embedding: Array(1536).fill(0.1), index: 3 },
        { embedding: Array(1536).fill(0.1), index: 4 },
      ];

      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: mockEmbeddings,
      });

      const results = await service.batchGenerateEmbeddings(texts);

      expect(results).toHaveLength(5);
      expect(results.every((r) => r.length === 1536)).toBe(true);
    });

    it('should continue processing if one batch fails', async () => {
      const texts = Array(25).fill(0).map((_, i) => `text ${i}`);
      const mockEmbeddings = Array(10)
        .fill(0)
        .map((_, idx) => ({
          embedding: Array(1536).fill(0.1),
          index: idx,
        }));

      // First batch succeeds, second batch fails, third batch succeeds
      (mockOpenAIClient.embeddings.create as jest.Mock)
        .mockResolvedValueOnce({ data: mockEmbeddings })
        .mockRejectedValueOnce(new Error('Batch 2 failed'))
        .mockResolvedValueOnce({ data: mockEmbeddings.slice(0, 5) });

      const results = await service.batchGenerateEmbeddings(texts);

      expect(results).toHaveLength(25);
      // Check that failed batch returned zero vectors
      const batch2 = results.slice(10, 20);
      expect(batch2.every((r) => r.every((v) => v === 0))).toBe(true);
    });

    it('should preserve order of embeddings with batch processing', async () => {
      const texts = ['a', 'b', 'c', 'd', 'e'];
      const mockEmbeddings = texts.map((text, idx) => ({
        embedding: Array(1536).fill(idx),
        index: idx,
      }));

      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: mockEmbeddings,
      });

      const results = await service.batchGenerateEmbeddings(texts);

      expect(results).toHaveLength(5);
      expect(results[0][0]).toBe(0);
      expect(results[1][0]).toBe(1);
      expect(results[2][0]).toBe(2);
      expect(results[3][0]).toBe(3);
      expect(results[4][0]).toBe(4);
    });
  });

  describe('getConfig', () => {
    it('should return current configuration', () => {
      const config = service.getConfig();

      expect(config).toEqual({
        provider: 'openai',
        model: 'text-embedding-3-small',
        dimensions: 1536,
        batchSize: 10,
      });
    });
  });

  describe('setConfig', () => {
    it('should update model configuration', () => {
      service.setConfig({ model: 'text-embedding-3-large' });

      const config = service.getConfig();
      expect(config.model).toBe('text-embedding-3-large');
    });

    it('should update dimensions configuration', () => {
      service.setConfig({ dimensions: 512 });

      const config = service.getConfig();
      expect(config.dimensions).toBe(512);
    });

    it('should update batch size configuration', () => {
      service.setConfig({ batchSize: 20 });

      const config = service.getConfig();
      expect(config.batchSize).toBe(20);
    });

    it('should update provider configuration', () => {
      service.setConfig({ provider: 'openai' });

      const config = service.getConfig();
      expect(config.provider).toBe('openai');
    });

    it('should ignore invalid batch size', () => {
      const originalConfig = service.getConfig();
      service.setConfig({ batchSize: -1 });

      const config = service.getConfig();
      expect(config.batchSize).toBe(originalConfig.batchSize);
    });

    it('should allow partial configuration updates', () => {
      service.setConfig({ model: 'text-embedding-3-large', dimensions: 512 });

      const config = service.getConfig();
      expect(config.model).toBe('text-embedding-3-large');
      expect(config.dimensions).toBe(512);
      expect(config.provider).toBe('openai');
      expect(config.batchSize).toBe(10);
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very large batch sizes', async () => {
      service.setConfig({ batchSize: 1000 });
      const texts = Array(100).fill('test');
      const mockEmbeddings = texts.map((_, idx) => ({
        embedding: Array(1536).fill(0.1),
        index: idx,
      }));

      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: mockEmbeddings,
      });

      const results = await service.batchGenerateEmbeddings(texts);

      expect(results).toHaveLength(100);
      expect(mockOpenAIClient.embeddings.create).toHaveBeenCalledTimes(1);
    });

    it('should handle rate limit errors gracefully', async () => {
      (mockOpenAIClient.embeddings.create as jest.Mock).mockRejectedValue(
        new Error('Rate limited')
      );

      const result = await service.generateEmbedding('test');

      expect(result).toHaveLength(1536);
      expect(result.every((v) => v === 0)).toBe(true);
    });

    it('should return correct embedding dimensions', async () => {
      const mockEmbedding = Array(1536).fill(0.5);
      (mockOpenAIClient.embeddings.create as jest.Mock).mockResolvedValue({
        data: [{ embedding: mockEmbedding, index: 0 }],
      });

      const result = await service.generateEmbedding('test');

      expect(result.length).toBe(1536);
    });

    it('should handle null or undefined text gracefully', async () => {
      const result1 = await service.generateEmbedding(null as any);
      expect(result1).toHaveLength(1536);

      const result2 = await service.generateEmbedding(undefined as any);
      expect(result2).toHaveLength(1536);
    });
  });
});

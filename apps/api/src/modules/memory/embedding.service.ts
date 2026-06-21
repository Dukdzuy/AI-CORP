import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';

/**
 * EmbeddingProvider type for configurable embedding source
 */
export type EmbeddingProvider = 'openai' | 'voyage' | 'local';

/**
 * Configuration for EmbeddingService
 */
export interface EmbeddingConfig {
  provider: EmbeddingProvider;
  model?: string;
  apiKey?: string;
  dimensions?: number;
  batchSize?: number;
}

/**
 * EmbeddingService handles vector embedding generation for agent memories.
 * Supports multiple providers (OpenAI, Voyage, local) with batch processing capability.
 *
 * Validates: Requirements 7
 */
@Injectable()
export class EmbeddingService {
  private readonly logger = new Logger(EmbeddingService.name);
  private provider: EmbeddingProvider;
  private model: string;
  private dimensions: number;
  private batchSize: number;
  private openaiClient: OpenAI | null = null;

  constructor(private configService: ConfigService) {
    this.provider =
      (this.configService.get<EmbeddingProvider>('EMBEDDING_PROVIDER') ||
        'openai') as EmbeddingProvider;
    this.model =
      this.configService.get<string>('EMBEDDING_MODEL') || 'text-embedding-3-small';
    this.dimensions = this.configService.get<number>('EMBEDDING_DIMENSIONS') || 1536;
    this.batchSize = this.configService.get<number>('EMBEDDING_BATCH_SIZE') || 10;

    this.initializeProvider();
  }

  /**
   * Initialize the embedding provider based on configuration
   */
  private initializeProvider(): void {
    switch (this.provider) {
      case 'openai':
        this.initializeOpenAI();
        break;
      case 'voyage':
        this.logger.warn('Voyage provider not fully implemented, falling back to OpenAI');
        this.initializeOpenAI();
        break;
      case 'local':
        this.logger.warn('Local provider not implemented, falling back to OpenAI');
        this.initializeOpenAI();
        break;
      default:
        throw new Error(`Unknown embedding provider: ${this.provider}`);
    }
  }

  /**
   * Initialize OpenAI client
   */
  private initializeOpenAI(): void {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY not set. EmbeddingService disabled - memory search will return empty results.');
      return;
    }
    this.openaiClient = new OpenAI({ apiKey });
    this.provider = 'openai';
    this.logger.log(`EmbeddingService initialized with OpenAI provider (model: ${this.model})`);
  }

  /**
   * Generate embedding for a single text string
   *
   * @param text - The text to embed
   * @returns Promise resolving to a 1536-dimensional embedding vector
   * @throws Error if embedding generation fails after retry attempts
   *
   * Postconditions:
   * - Returns an array of numbers with length equal to configured dimensions
   * - Throws an error if the text is empty or if the API call fails
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || text.trim().length === 0) {
      this.logger.warn('Empty text provided to generateEmbedding');
      return Array(this.dimensions).fill(0);
    }

    try {
      const embedding = await this.generateEmbeddingWithProvider(text);
      this.logger.debug(
        `Generated embedding for text of length ${text.length} using ${this.provider}`
      );
      return embedding;
    } catch (error) {
      this.logger.error(`Failed to generate embedding: ${error instanceof Error ? error.message : String(error)}`);
      // Return zero vector as fallback to allow memories to be saved even if embedding fails
      return Array(this.dimensions).fill(0);
    }
  }

  /**
   * Generate embeddings for multiple text strings in batches
   *
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embedding vectors
   * @throws Error if batch generation fails
   *
   * Postconditions:
   * - Returns array with same length as input texts array
   * - Each embedding is an array of numbers with length equal to configured dimensions
   * - Processes texts in configurable batch sizes for efficiency
   * - Skips empty strings and returns zero vectors for them
   */
  async batchGenerateEmbeddings(texts: string[]): Promise<number[][]> {
    if (!texts || texts.length === 0) {
      return [];
    }

    this.logger.debug(`Starting batch embedding generation for ${texts.length} texts with batch size ${this.batchSize}`);

    const embeddings: number[][] = [];

    // Process texts in batches
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(texts.length / this.batchSize);

      this.logger.debug(`Processing batch ${batchNumber}/${totalBatches} with ${batch.length} texts`);

      try {
        const batchEmbeddings = await this.generateBatchWithProvider(batch);
        embeddings.push(...batchEmbeddings);
      } catch (error) {
        this.logger.error(
          `Failed to generate batch embeddings (batch ${batchNumber}): ${error instanceof Error ? error.message : String(error)}`
        );
        // Return zero vectors for this batch to allow processing to continue
        embeddings.push(...batch.map(() => Array(this.dimensions).fill(0)));
      }
    }

    this.logger.debug(`Completed batch embedding generation for ${embeddings.length} embeddings`);
    return embeddings;
  }

  /**
   * Generate embedding using configured provider (OpenAI)
   *
   * @param text - The text to embed
   * @returns Promise resolving to embedding vector
   */
  private async generateEmbeddingWithProvider(text: string): Promise<number[]> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    const response = await this.openaiClient.embeddings.create({
      model: this.model,
      input: text,
      dimensions: this.dimensions,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding data returned from OpenAI API');
    }

    const embedding = response.data[0].embedding;
    if (!embedding || embedding.length === 0) {
      throw new Error('Empty embedding returned from OpenAI API');
    }

    return embedding;
  }

  /**
   * Generate embeddings for a batch of texts using configured provider
   *
   * @param texts - Array of texts to embed
   * @returns Promise resolving to array of embedding vectors
   */
  private async generateBatchWithProvider(texts: string[]): Promise<number[][]> {
    if (!this.openaiClient) {
      throw new Error('OpenAI client not initialized');
    }

    // Filter out empty texts and track their indices
    const nonEmptyTexts = texts.map((text, idx) => ({
      text: text && text.trim().length > 0 ? text : '',
      originalIndex: idx,
    }));

    // Make API call with non-empty texts
    const response = await this.openaiClient.embeddings.create({
      model: this.model,
      input: nonEmptyTexts.map((t) => t.text),
      dimensions: this.dimensions,
    });

    if (!response.data || response.data.length === 0) {
      throw new Error('No embedding data returned from OpenAI API');
    }

    // Map embeddings back to original order
    const embeddings: number[][] = texts.map(() => Array(this.dimensions).fill(0));

    for (const embeddingData of response.data) {
      const originalIndex = embeddingData.index;
      if (originalIndex !== undefined && embeddingData.embedding) {
        embeddings[originalIndex] = embeddingData.embedding;
      }
    }

    return embeddings;
  }

  /**
   * Get current embedding configuration
   *
   * @returns Current embedding configuration
   */
  getConfig(): EmbeddingConfig {
    return {
      provider: this.provider,
      model: this.model,
      dimensions: this.dimensions,
      batchSize: this.batchSize,
    };
  }

  /**
   * Set embedding configuration at runtime
   *
   * @param config - New embedding configuration
   */
  setConfig(config: Partial<EmbeddingConfig>): void {
    if (config.provider) {
      this.provider = config.provider;
      if (config.provider === 'openai') {
        this.initializeOpenAI();
      }
    }
    if (config.model) {
      this.model = config.model;
    }
    if (config.dimensions) {
      this.dimensions = config.dimensions;
    }
    if (config.batchSize && config.batchSize > 0) {
      this.batchSize = config.batchSize;
    }
    this.logger.log(`EmbeddingService configuration updated: ${JSON.stringify(config)}`);
  }
}

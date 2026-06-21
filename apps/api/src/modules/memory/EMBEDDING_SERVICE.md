# EmbeddingService Documentation

## Overview

The `EmbeddingService` is a NestJS service that handles vector embedding generation for agent memories. It provides a unified interface for generating embeddings using configurable providers (currently supports OpenAI, with Voyage and local providers planned).

**Validates**: Requirement 7 - Vector Memory System

## Features

- **Single Embedding Generation**: Generate embeddings for individual text strings
- **Batch Processing**: Generate embeddings for multiple texts efficiently with configurable batch sizes
- **Configurable Provider**: Support for multiple embedding providers (OpenAI, Voyage, local)
- **1536-Dimensional Embeddings**: Default support for OpenAI Ada's standard 1536-dimensional vectors
- **Error Handling**: Graceful fallback to zero vectors on failures to allow memory operations to continue
- **Runtime Configuration**: Update embedding settings at runtime without service restart

## Architecture

### Class Structure

```typescript
class EmbeddingService {
  // Core methods
  generateEmbedding(text: string): Promise<number[]>
  batchGenerateEmbeddings(texts: string[]): Promise<number[][]>
  
  // Configuration methods
  getConfig(): EmbeddingConfig
  setConfig(config: Partial<EmbeddingConfig>): void
  
  // Provider initialization
  private initializeProvider(): void
  private initializeOpenAI(): void
}
```

### Configuration

The service is configured via environment variables:

```bash
# Provider selection (default: 'openai')
EMBEDDING_PROVIDER=openai

# Model specification (default: 'text-embedding-3-small')
EMBEDDING_MODEL=text-embedding-3-small

# Embedding dimensions (default: 1536)
EMBEDDING_DIMENSIONS=1536

# Batch processing size (default: 10)
EMBEDDING_BATCH_SIZE=10

# Required API key for OpenAI
OPENAI_API_KEY=sk-...
```

## Usage

### Basic Setup

```typescript
import { Module } from '@nestjs/common';
import { MemoryModule } from './memory/memory.module';

@Module({
  imports: [MemoryModule],
})
export class AppModule {}
```

### Single Embedding Generation

```typescript
import { EmbeddingService } from './memory/embedding.service';

constructor(private embeddingService: EmbeddingService) {}

async generateMemoryEmbedding() {
  const text = 'This is a memory about team conventions';
  const embedding = await this.embeddingService.generateEmbedding(text);
  
  // embedding is a number[] with length 1536
  console.log(embedding.length); // 1536
}
```

### Batch Embedding Generation

```typescript
async generateMultipleEmbeddings() {
  const texts = [
    'First memory content',
    'Second memory content',
    'Third memory content'
  ];
  
  const embeddings = await this.embeddingService.batchGenerateEmbeddings(texts);
  
  // embeddings is number[][] with shape [3, 1536]
  console.log(embeddings.length); // 3
  console.log(embeddings[0].length); // 1536
}
```

### Runtime Configuration

```typescript
async updateEmbeddingConfig() {
  // Get current config
  const config = this.embeddingService.getConfig();
  console.log(config);
  // Output: {
  //   provider: 'openai',
  //   model: 'text-embedding-3-small',
  //   dimensions: 1536,
  //   batchSize: 10
  // }
  
  // Update specific settings
  this.embeddingService.setConfig({
    model: 'text-embedding-3-large',
    dimensions: 3072,
    batchSize: 20
  });
}
```

## Implementation Details

### Error Handling Strategy

The service uses a graceful fallback strategy to ensure memories can be saved even if embedding generation fails:

1. **Empty/Null Text**: Returns zero vector without making API call
2. **API Failures**: Logs error and returns zero vector
3. **Invalid Responses**: Returns zero vector
4. **Batch Failures**: Returns zero vectors for failed batch while continuing with remaining batches

This ensures that memory operations continue working even if the embedding service is temporarily unavailable.

### Batch Processing

Batch processing divides large text arrays into smaller chunks to avoid API limits:

```
Input: 25 texts, batch size 10
Execution:
  - Batch 1: texts 0-9 (10 texts) → API call
  - Batch 2: texts 10-19 (10 texts) → API call
  - Batch 3: texts 20-24 (5 texts) → API call
Output: 25 embeddings
```

Benefits:
- Handles large arrays of texts
- Respects API rate limits
- Allows per-batch error handling
- Configurable batch size

### OpenAI Integration

The service uses the OpenAI Node.js client library:

```typescript
const response = await this.openaiClient.embeddings.create({
  model: 'text-embedding-3-small',
  input: text,  // single string or array of strings
  dimensions: 1536
});
```

The API returns embeddings with associated indices, which are mapped back to original positions in batch operations.

## Requirements Validation

### Requirement 7: Vector Memory System

**AC 1**: When an agent saves a memory, THE Memory_Service SHALL generate a vector embedding for the content
- ✅ Implemented via `generateEmbedding()` method

**AC 2**: When an agent saves a memory, THE Memory_Service SHALL store the memory with agent role, namespace, and importance rating
- ℹ️ Embedding generation complete; storage handled by MemoryService

**AC 3**: When an agent searches for memories with a query, THE Memory_Service SHALL generate a query embedding
- ✅ `generateEmbedding()` used for query text

**AC 4-8**: Search and filtering logic
- ℹ️ Handled by MemoryService with embeddings from EmbeddingService

## Error Scenarios

### Empty Text Input
```typescript
const embedding = await service.generateEmbedding('');
// Returns: [0, 0, 0, ..., 0] (1536 zeros)
```

### API Unavailable
```typescript
const embedding = await service.generateEmbedding('text');
// Logs: "Failed to generate embedding: API error"
// Returns: [0, 0, 0, ..., 0] (fallback zero vector)
```

### Invalid Batch
```typescript
const embeddings = await service.batchGenerateEmbeddings([
  'text1',
  '',
  'text3'
]);
// Returns: [embedding1, zero_vector, embedding3]
// Failed batch with error continues with remaining texts
```

## Performance Characteristics

- **Single Embedding**: ~100-200ms (network latency dependent)
- **Batch of 10**: ~200-400ms (API batching efficiency)
- **Memory Usage**: ~50KB per embedding vector (1536 * 4 bytes per float32)

## Testing

Comprehensive test suite included (`embedding.service.spec.ts`):

- Initialization tests
- Single embedding generation
- Batch processing with various sizes
- Error handling and fallback behavior
- Configuration management
- Edge cases (empty text, very large batches, etc.)

Run tests:
```bash
npm test -- --testPathPattern="embedding.service.spec"
```

## Future Enhancements

1. **Voyage Provider Support**: Implement Voyage embeddings API
2. **Local Provider**: Add local embedding models (e.g., using ONNX)
3. **Caching**: Cache frequently generated embeddings
4. **Retry Logic**: Add exponential backoff for transient failures
5. **Monitoring**: Add metrics for embedding generation times and costs
6. **Model Switching**: Support dynamic model selection per request

## Related Services

- **MemoryService**: Uses EmbeddingService to generate embeddings for stored memories
- **LLM Gateway**: Similar pattern for LLM provider abstraction
- **Tool Registry**: Follows similar configuration and dependency injection patterns

## Troubleshooting

### "OPENAI_API_KEY environment variable is not set"

**Solution**: Set the OPENAI_API_KEY environment variable:
```bash
export OPENAI_API_KEY=sk-...
```

### Embeddings have wrong dimensions

**Check Configuration**:
```typescript
const config = service.getConfig();
console.log(config.dimensions); // Should be 1536 or configured value
```

### Batch processing is slow

**Optimize Batch Size**:
```typescript
service.setConfig({ batchSize: 25 }); // Larger batches = fewer API calls
```

### Zero vectors returned for valid text

**Check**:
1. OpenAI API connectivity
2. API key validity
3. Rate limits not exceeded
4. Check service logs for specific errors

## API Reference

### `generateEmbedding(text: string): Promise<number[]>`

Generate an embedding for a single text string.

**Parameters**:
- `text` (string): Text to embed

**Returns**: Promise resolving to number[] with length equal to configured dimensions (default 1536)

**Throws**: Never throws; returns zero vector on error

**Example**:
```typescript
const embedding = await service.generateEmbedding('Hello, world!');
```

### `batchGenerateEmbeddings(texts: string[]): Promise<number[][]>`

Generate embeddings for multiple texts in batches.

**Parameters**:
- `texts` (string[]): Array of texts to embed

**Returns**: Promise resolving to number[][] with shape [texts.length, dimensions]

**Throws**: Never throws; returns zero vectors for failed items

**Example**:
```typescript
const embeddings = await service.batchGenerateEmbeddings(['text1', 'text2']);
```

### `getConfig(): EmbeddingConfig`

Get current embedding service configuration.

**Returns**: Current EmbeddingConfig object

**Example**:
```typescript
const config = service.getConfig();
console.log(config.model); // 'text-embedding-3-small'
```

### `setConfig(config: Partial<EmbeddingConfig>): void`

Update embedding service configuration at runtime.

**Parameters**:
- `config` (Partial<EmbeddingConfig>): Configuration to update

**Example**:
```typescript
service.setConfig({ batchSize: 20, dimensions: 3072 });
```

## License

Part of AI Corp Platform. See main LICENSE file.

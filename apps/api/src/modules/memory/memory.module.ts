import { Module } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { MemoryService } from './memory.service';

@Module({
  providers: [EmbeddingService, MemoryService],
  exports: [EmbeddingService, MemoryService],
})
export class MemoryModule {}

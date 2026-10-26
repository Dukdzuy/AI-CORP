import { Module, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../domain/events/EventBus';
import { MemoryModule } from '../memory/memory.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AgentsModule } from '../agents/agents.module';
import { LearningService } from './learning.service';
import { AgentLearningHandler } from './agent-learning.handler';
import { LearningController } from './learning.controller';

/**
 * Learning Module (Phase 3, Task 14)
 *
 * Agents learn from the quality signals the workflow produces: graded outcomes are stored as
 * memories and periodically refined into lessons that the thinking strategies recall first.
 * Subscribes its handler to the global EventBus itself, so EventsModule stays unchanged.
 */
@Module({
  imports: [MemoryModule, PrismaModule, AgentsModule],
  controllers: [LearningController],
  providers: [LearningService, AgentLearningHandler],
  exports: [LearningService],
})
export class LearningModule implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly handler: AgentLearningHandler
  ) {}

  onModuleInit(): void {
    for (const eventType of AgentLearningHandler.EVENT_TYPES) {
      this.eventBus.subscribe(eventType, this.handler);
    }
  }
}

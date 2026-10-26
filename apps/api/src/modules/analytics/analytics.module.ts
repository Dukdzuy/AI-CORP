import { Module, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../domain/events/EventBus';
import { AgentAnalyticsService } from './agent-analytics.service';
import { AgentAnomalyMonitor } from './agent-anomaly.monitor';
import { AnalyticsController } from './analytics.controller';

/**
 * Analytics (Phase 6): agent performance and anomaly alerts (Task 24).
 * Subscribes its monitor to the global EventBus itself, like the learning module.
 */
@Module({
  controllers: [AnalyticsController],
  providers: [AgentAnalyticsService, AgentAnomalyMonitor],
  exports: [AgentAnalyticsService],
})
export class AnalyticsModule implements OnModuleInit {
  constructor(private readonly eventBus: EventBus, private readonly monitor: AgentAnomalyMonitor) {}

  onModuleInit(): void {
    for (const eventType of AgentAnomalyMonitor.EVENT_TYPES) this.eventBus.subscribe(eventType, this.monitor);
  }
}

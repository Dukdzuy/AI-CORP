import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler, EventBus } from '../../domain/events/EventBus';
import { DomainEvent } from '../../domain/events/DomainEvent';
import { AgentAnomalyDetectedEvent } from '../../domain/events/AgentAnomalyDetectedEvent';
import { AgentAnomalyDetector } from '../../domain/analytics';
import { AgentAnalyticsService } from './agent-analytics.service';

/**
 * Checks agent performance whenever a workflow run ends and raises an
 * `AgentAnomalyDetectedEvent` for each new anomaly (Phase 6, Task 24). The same anomaly
 * is raised at most once per role, type and day.
 *
 * @pattern Observer
 */
@Injectable()
export class AgentAnomalyMonitor implements IEventHandler {
  static readonly EVENT_TYPES = ['workflow.completed', 'workflow.failed'];
  /** Look-back window of the check; the previous window of the same length is the baseline */
  static readonly WINDOW_DAYS = 7;

  private readonly logger = new Logger(AgentAnomalyMonitor.name);
  private readonly raised = new Set<string>();

  constructor(private readonly analytics: AgentAnalyticsService, private readonly eventBus: EventBus) {}

  async handle(event: DomainEvent): Promise<void> {
    const projectId = (event as any).projectId ?? null;
    await this.check(projectId, event.occurredOn);
  }

  /** Returns the anomalies raised by this check */
  async check(projectId: string | null = null, now = new Date()): Promise<AgentAnomalyDetectedEvent[]> {
    try {
      const view = await this.analytics.analytics({ days: AgentAnomalyMonitor.WINDOW_DAYS }, now);
      const events: AgentAnomalyDetectedEvent[] = [];
      for (const a of view.anomalies) {
        const key = AgentAnomalyDetector.key(a, now);
        if (this.raised.has(key)) continue;
        this.raised.add(key);
        const event = new AgentAnomalyDetectedEvent(a.agentRole, a.type, a.severity, a.message, a.value, a.threshold, projectId);
        await this.eventBus.publish(event);
        events.push(event);
        this.logger.warn(`Agent anomaly: ${a.message}`);
      }
      return events;
    } catch (err: any) {
      this.logger.warn(`Agent anomaly check failed: ${err.message}`);
      return [];
    }
  }
}

/**
 * Events Module
 * 
 * Central module for domain event infrastructure.
 * Wires up the EventBus, registers all handlers, and initializes DomainEvents facade.
 * 
 * Initialization Flow:
 * 1. NestJS creates EventBus and all handler instances
 * 2. onModuleInit() wires DomainEvents facade to EventBus
 * 3. onModuleInit() subscribes all handlers to their event types
 * 4. Domain entities can now raise events via DomainEvents.raise()
 * 
 * @Global() decorator makes EventBus available to all modules without explicit import
 * 
 * @pattern Observer Pattern, Facade Pattern
 * @principle Dependency Inversion - domain layer depends on abstractions
 */

import { Global, Module, OnModuleInit } from '@nestjs/common';
import { EventBus } from '../../domain/events/EventBus';
import { DomainEvents } from '../../domain/events/DomainEvents';
import {
  BudgetExceededHandler,
  AgentCompletedTaskHandler,
  WorkflowPausedHandler,
  NotificationHandler,
  AuditLogHandler,
  MetricsHandler
} from './handlers';
import { WebSocketModule } from '../websocket/websocket.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Global()
@Module({
  imports: [WebSocketModule, PrismaModule],
  providers: [
    EventBus,
    BudgetExceededHandler,
    AgentCompletedTaskHandler,
    WorkflowPausedHandler,
    // Task 10: New handlers
    NotificationHandler,
    AuditLogHandler,
    MetricsHandler
  ],
  exports: [EventBus]
})
export class EventsModule implements OnModuleInit {
  constructor(
    private readonly eventBus: EventBus,
    private readonly budgetExceededHandler: BudgetExceededHandler,
    private readonly agentCompletedTaskHandler: AgentCompletedTaskHandler,
    private readonly workflowPausedHandler: WorkflowPausedHandler,
    // Task 10: Inject new handlers
    private readonly notificationHandler: NotificationHandler,
    private readonly auditLogHandler: AuditLogHandler,
    private readonly metricsHandler: MetricsHandler
  ) {}

  onModuleInit() {
    // Wire up DomainEvents static facade
    DomainEvents.setEventBus(this.eventBus);

    // Subscribe all handlers to their event types
    this.eventBus.subscribe('project.budget.exceeded', this.budgetExceededHandler);
    this.eventBus.subscribe('agent.task.completed', this.agentCompletedTaskHandler);
    this.eventBus.subscribe('workflow.paused', this.workflowPausedHandler);

    // Task 10: Subscribe new handlers to ALL event types (cross-cutting concerns)
    const allEventTypes = [
      'project.created',
      'task.assigned',
      'task.completed',
      'workflow.started',
      'workflow.completed',
      'approval.requested',
      'project.budget.exceeded',
      'agent.task.completed',
      'workflow.paused'
    ];

    // NotificationHandler, AuditLogHandler, and MetricsHandler listen to all events
    allEventTypes.forEach(eventType => {
      this.eventBus.subscribe(eventType, this.notificationHandler);
      this.eventBus.subscribe(eventType, this.auditLogHandler);
      this.eventBus.subscribe(eventType, this.metricsHandler);
    });

    console.log('EventsModule initialized: DomainEvents facade wired, handlers subscribed');
    console.log(`Total event types registered: ${allEventTypes.length}`);
  }
}

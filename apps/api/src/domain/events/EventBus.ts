/**
 * Event Bus
 * 
 * Central event dispatcher implementing the Observer Pattern.
 * Manages event handlers and dispatches events to subscribed handlers.
 * 
 * Key Features:
 * - Type-safe event subscription
 * - Error isolation (one handler failure doesn't stop others)
 * - Async event handling
 * - Multiple handlers per event type
 * 
 * @pattern Observer Pattern (GoF), Mediator Pattern
 * @principle Loose Coupling - publishers don't know subscribers
 */

import { Injectable, Logger } from '@nestjs/common';
import { DomainEvent } from './DomainEvent';
import { IEventPublisher } from './IEventPublisher';

export interface IEventHandler<T extends DomainEvent = DomainEvent> {
  handle(event: T): Promise<void>;
}

@Injectable()
export class EventBus implements IEventPublisher {
  private readonly logger = new Logger(EventBus.name);
  private handlers = new Map<string, IEventHandler[]>();

  /**
   * Subscribe a handler to a specific event type
   */
  subscribe(eventType: string, handler: IEventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    this.logger.log(`Subscribed handler to event type: ${eventType}`);
  }

  /**
   * Publish an event to all subscribed handlers
   * 
   * **Important: Eventual Consistency Model**
   * - Handlers execute asynchronously and independently
   * - Handler execution order is UNDEFINED - do not rely on sequence
   * - One handler's failure does not stop others from executing
   * - Events are fire-and-forget: publish() returns immediately after dispatching
   * - For critical operations requiring consistency, use transactions or sagas
   * 
   * Error Handling: If one handler fails, others still execute.
   * Failures are logged but not propagated to the caller.
   * 
   * @param event - The domain event to publish to all handlers
   */
  async publish(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.eventType) || [];
    
    if (handlers.length === 0) {
      this.logger.debug(`No handlers registered for event type: ${event.eventType}`);
      return;
    }

    this.logger.log(`Publishing event: ${event.eventType} (eventId: ${event.eventId})`);

    // Execute all handlers, catching errors to prevent one failure from stopping others
    const results = await Promise.allSettled(
      handlers.map(handler => handler.handle(event))
    );

    // Log any handler failures
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        this.logger.error(
          `Handler ${index} for event ${event.eventType} failed: ${result.reason?.message || result.reason}`,
          result.reason?.stack
        );
      }
    });
  }

  /**
   * Get the number of handlers registered for an event type (for testing)
   */
  getHandlerCount(eventType: string): number {
    return this.handlers.get(eventType)?.length || 0;
  }

  /**
   * Clear all handlers (for testing)
   */
  clearHandlers(): void {
    this.handlers.clear();
  }
}

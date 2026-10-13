/**
 * Domain Events Static Facade
 * 
 * Static class providing a global access point to the event bus.
 * Allows domain entities to raise events without direct EventBus dependency.
 * 
 * Usage in entities:
 *   DomainEvents.raise(new BudgetExceededEvent(projectId, cost, budget));
 * 
 * Initialization (in EventsModule.onModuleInit):
 *   DomainEvents.setEventBus(this.eventBus);
 * 
 * @pattern Facade Pattern, Singleton Pattern
 * @principle Dependency Inversion - entities depend on abstraction, not concrete EventBus
 */

import { EventBus } from './EventBus';
import { DomainEvent } from './DomainEvent';

export class DomainEvents {
  private static eventBus: EventBus | null = null;

  /**
   * Set the event bus instance (called once during app initialization)
   */
  static setEventBus(bus: EventBus): void {
    DomainEvents.eventBus = bus;
  }

  /**
   * Raise a domain event
   * 
   * Note: Events are published asynchronously. Errors are caught and logged
   * but don't propagate to the caller (fire-and-forget semantics).
   */
  static raise(event: DomainEvent): void {
    if (DomainEvents.eventBus) {
      DomainEvents.eventBus.publish(event).catch(err => {
        console.error(`Failed to publish event ${event.eventType}:`, err);
      });
    } else {
      console.warn(`EventBus not initialized. Event ${event.eventType} will not be published.`);
    }
  }

  /**
   * Clear the event bus (for testing)
   */
  static clearEventBus(): void {
    DomainEvents.eventBus = null;
  }
}

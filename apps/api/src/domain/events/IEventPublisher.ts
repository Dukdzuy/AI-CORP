import { DomainEvent } from './DomainEvent';

/**
 * IEventPublisher - Domain interface for event publishing
 * 
 * Abstracts event publishing to satisfy Dependency Inversion Principle (DIP).
 * Domain layer depends on this interface, infrastructure provides EventBus implementation.
 * 
 * This allows:
 * - Domain entities and repositories to publish events without coupling to infrastructure
 * - EventBus implementation details to remain in infrastructure layer
 * - Easy testing with mock implementations
 * 
 * @pattern Dependency Inversion Principle (SOLID)
 * @principle Domain layer defines contracts, infrastructure implements them
 */
export interface IEventPublisher {
  /**
   * Publish a domain event to all registered handlers
   * 
   * @param event - The domain event to publish
   * @returns Promise that resolves when all handlers have been invoked
   */
  publish(event: DomainEvent): Promise<void>;
}

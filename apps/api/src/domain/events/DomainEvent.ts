/**
 * Domain Event Base Class
 * 
 * Abstract base for all domain events following the Observer Pattern.
 * Events are raised by entities when significant business events occur.
 * 
 * @pattern Observer Pattern (GoF), Event-Driven Architecture
 * @principle Tell, Don't Ask - entities publish events rather than calling services
 */

import { randomUUID } from 'crypto';

export abstract class DomainEvent {
  readonly occurredOn: Date = new Date();
  readonly eventId: string;
  abstract readonly eventType: string;

  constructor() {
    this.eventId = randomUUID();
  }
}

/**
 * Project Created Event
 * 
 * Raised when a new project is created in the system.
 * Useful for triggering notifications, audit logs, and metrics tracking.
 * 
 * @pattern Observer Pattern
 * @principle Event-Driven Architecture
 */

import { DomainEvent } from './DomainEvent';

export class ProjectCreatedEvent extends DomainEvent {
  readonly eventType = 'project.created';

  constructor(
    public readonly projectId: string,
    public readonly projectName: string,
    public readonly createdById: string,
    public readonly budget?: number
  ) {
    super();
  }
}

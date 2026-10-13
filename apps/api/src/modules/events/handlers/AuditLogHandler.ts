/**
 * Audit Log Handler
 * 
 * Handles domain events by writing them to an audit log.
 * This is a placeholder implementation - in production, this would:
 * - Write to a dedicated audit log database table
 * - Send events to centralized logging service (e.g., Elasticsearch, Splunk)
 * - Store immutable audit trail for compliance
 * - Support audit queries and reporting
 * 
 * @pattern Observer Pattern, Strategy Pattern
 * @principle Single Responsibility - only handles audit logging
 * @principle Open/Closed - new event types don't require changes
 */

import { Injectable, Logger } from '@nestjs/common';
import { IEventHandler } from '../../../domain/events/EventBus';
import { DomainEvent } from '../../../domain/events/DomainEvent';

@Injectable()
export class AuditLogHandler implements IEventHandler {
  private readonly logger = new Logger(AuditLogHandler.name);

  async handle(event: DomainEvent): Promise<void> {
    // Create audit log entry
    const auditEntry = {
      timestamp: event.occurredOn.toISOString(),
      eventId: event.eventId,
      eventType: event.eventType,
      payload: this.extractAuditPayload(event),
      source: 'domain-event-system'
    };

    // Log to console (placeholder for actual audit log persistence)
    this.logger.log(
      `📝 [AUDIT LOG] ${JSON.stringify(auditEntry, null, 2)}`
    );

    // TODO: Persist to audit_logs table in database
    // TODO: Send to centralized logging service
    // TODO: Implement log retention policies
  }

  /**
   * Extract relevant audit information from event
   * Avoids logging sensitive data while maintaining audit trail
   */
  private extractAuditPayload(event: DomainEvent): any {
    const payload: any = { ...event };
    
    // Remove base class properties (already captured separately)
    delete payload.occurredOn;
    delete payload.eventId;
    delete payload.eventType;

    // TODO: Add sensitive data filtering/masking
    // TODO: Add user context (who triggered the event)
    
    return payload;
  }
}

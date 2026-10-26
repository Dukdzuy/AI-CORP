import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  AUDIT_LOG_REPOSITORY,
  AnomalyDetector,
  AuditActor,
  AuditEntry,
  AuditLogFilter,
  IAuditLogRepository,
  NewAuditEntry,
  SecurityAnomaly,
} from '../../domain/audit';
import { toCsv } from '../../domain/reporting';
import { Principal } from '../../domain/security';
import { clientIp } from '../access/access.decorators';

export const AUDIT_CSV_MAX_ROWS = 10_000;

/**
 * Application service for the audit trail (Phase 5, Task 21): records entries, answers
 * filtered queries, exports CSV and runs anomaly detection over a recent window.
 *
 * Recording never breaks the audited operation: a storage failure is logged, not thrown.
 */
@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);
  private readonly detector = new AnomalyDetector();

  constructor(@Inject(AUDIT_LOG_REPOSITORY) private readonly repository: IAuditLogRepository) {}

  async record(input: NewAuditEntry): Promise<AuditEntry | null> {
    try {
      const entry = AuditEntry.record(input);
      await this.repository.append(entry);
      return entry;
    } catch (error) {
      this.logger.error(`Audit entry '${input.action}' not recorded: ${(error as Error).message}`);
      return null;
    }
  }

  async recordDenied(principal: Principal | undefined, target: string, needed: string, request?: any): Promise<void> {
    await this.record({
      actor: AuditLogService.actorOf(principal),
      action: 'access.denied',
      resourceType: 'Access',
      resourceId: target.slice(0, 200),
      changes: { needed },
      success: false,
      errorMessage: `Denied: needs ${needed}`,
      ...AuditLogService.requestInfo(request),
    });
  }

  query(filter: AuditLogFilter, page = 1, pageSize = 50) {
    return this.repository.query(filter, Math.max(1, page), Math.min(200, Math.max(1, pageSize)));
  }

  async exportCsv(filter: AuditLogFilter): Promise<string> {
    const entries = await this.repository.list(filter, AUDIT_CSV_MAX_ROWS);
    return toCsv(
      ['timestamp', 'actor_type', 'actor', 'user_id', 'api_key_id', 'agent_role', 'action', 'resource_type', 'resource_id', 'project_id', 'success', 'error', 'ip', 'user_agent', 'changes'],
      entries.map(e => [
        e.timestamp, e.actor.type, e.actor.label, e.actor.userId, e.actor.apiKeyId, e.actor.agentRole,
        e.action, e.resourceType, e.resourceId, e.projectId, e.success, e.errorMessage, e.ipAddress, e.userAgent, e.changes,
      ])
    );
  }

  /** Anomalies in the last `hours` (default 24), newest first */
  async detectAnomalies(hours = 24, now = new Date()): Promise<SecurityAnomaly[]> {
    const from = new Date(now.getTime() - hours * 3_600_000);
    const [logins, denials] = await Promise.all([
      this.repository.list({ action: 'auth.login', success: false, from, to: now }, 5_000),
      this.repository.list({ action: 'access.denied', from, to: now }, 5_000),
    ]);
    return this.detector.detect([...logins, ...denials]);
  }

  static actorOf(principal: Principal | undefined | null, fallbackLabel?: string | null): AuditActor {
    if (!principal) return { type: 'anonymous', label: fallbackLabel ?? null };
    return {
      type: principal.kind === 'api_key' ? 'api_key' : 'user',
      userId: principal.userId,
      label: principal.label(),
      apiKeyId: principal.apiKeyId ?? null,
    };
  }

  static requestInfo(request?: any): { ipAddress: string | null; userAgent: string | null } {
    if (!request) return { ipAddress: null, userAgent: null };
    return { ipAddress: clientIp(request), userAgent: request.headers?.['user-agent'] ?? null };
  }
}

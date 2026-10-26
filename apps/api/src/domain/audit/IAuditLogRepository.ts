/**
 * Audit log persistence port (Phase 5, Task 21). Append-only by design: there is no
 * update or delete, so an entry can't be rewritten through the application.
 */
import { AuditEntry } from './AuditEntry';

export interface AuditLogFilter {
  userId?: string;
  /** exact action, or a prefix ending in '.' / '*' (e.g. 'project.*') */
  action?: string;
  resourceType?: string;
  resourceId?: string;
  projectId?: string;
  success?: boolean;
  from?: Date;
  to?: Date;
  /** free text over actor label, action and resource id */
  search?: string;
}

export interface AuditLogPage {
  items: AuditEntry[];
  total: number;
  page: number;
  pageSize: number;
}

export interface IAuditLogRepository {
  append(entry: AuditEntry): Promise<void>;
  query(filter: AuditLogFilter, page: number, pageSize: number): Promise<AuditLogPage>;
  /** newest first, at most `limit` entries */
  list(filter: AuditLogFilter, limit: number): Promise<AuditEntry[]>;
}

export const AUDIT_LOG_REPOSITORY = Symbol('IAuditLogRepository');

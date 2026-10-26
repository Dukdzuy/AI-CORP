import { AuditEntry, AuditLogFilter, AuditLogPage, IAuditLogRepository } from '../../../src/domain/audit';
import { ApiKey, IApiKeyRepository, IWebhookRepository, Webhook, WebhookDeliveryRecord } from '../../../src/domain/integration';

/** In-memory adapters of the Phase 5 repository ports, for tests */
export class InMemoryAuditLogRepository implements IAuditLogRepository {
  entries: AuditEntry[] = [];

  async append(entry: AuditEntry) {
    this.entries.push(entry);
  }
  async query(filter: AuditLogFilter, page: number, pageSize: number): Promise<AuditLogPage> {
    const all = this.filter(filter);
    return { items: all.slice((page - 1) * pageSize, page * pageSize), total: all.length, page, pageSize };
  }
  async list(filter: AuditLogFilter, limit: number) {
    return this.filter(filter).slice(0, limit);
  }
  actions() {
    return this.entries.map(e => e.action);
  }
  private filter(f: AuditLogFilter) {
    return this.entries
      .filter(e =>
        (!f.userId || e.actor.userId === f.userId) &&
        (!f.action || (/[.*]$/.test(f.action) ? e.action.startsWith(f.action.replace(/\*$/, '')) : e.action === f.action)) &&
        (!f.resourceType || e.resourceType === f.resourceType) &&
        (!f.projectId || e.projectId === f.projectId) &&
        (f.success === undefined || e.success === f.success) &&
        (!f.from || e.timestamp >= f.from) &&
        (!f.to || e.timestamp <= f.to)
      )
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }
}

export class InMemoryApiKeyRepository implements IApiKeyRepository {
  rows = new Map<string, ApiKey>();
  async save(key: ApiKey) {
    this.rows.set(key.id, ApiKey.fromPersistence(key.toPrimitives()));
  }
  async findById(id: string) {
    const k = this.rows.get(id);
    return k ? ApiKey.fromPersistence(k.toPrimitives()) : null;
  }
  async findByOwner(ownerId: string | null) {
    return [...this.rows.values()].filter(k => !ownerId || k.ownerId === ownerId);
  }
  async touch(id: string, at: Date) {
    this.rows.get(id)?.markUsed(at);
  }
}

export class InMemoryWebhookRepository implements IWebhookRepository {
  rows = new Map<string, Webhook>();
  deliveries: WebhookDeliveryRecord[] = [];
  async save(w: Webhook) {
    this.rows.set(w.id, w);
  }
  async findById(id: string) {
    return this.rows.get(id) ?? null;
  }
  async findByOwner(ownerId: string | null) {
    return [...this.rows.values()].filter(w => !ownerId || w.ownerId === ownerId);
  }
  async findActiveForEvent(event: string) {
    return [...this.rows.values()].filter(w => w.toPrimitives().active && w.events.includes(event as any));
  }
  async delete(id: string) {
    this.rows.delete(id);
  }
  async recordDelivery(d: WebhookDeliveryRecord) {
    this.deliveries.push(d);
  }
  async listDeliveries(webhookId: string, limit: number) {
    return this.deliveries.filter(d => d.webhookId === webhookId).slice(0, limit);
  }
}

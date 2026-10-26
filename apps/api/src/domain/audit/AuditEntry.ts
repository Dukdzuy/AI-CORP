/**
 * AuditEntry (Phase 5, Task 21)
 *
 * One immutable record of something that happened: who (actor), did what (action) to which
 * resource, whether it worked, and what changed. Entries are only ever appended.
 *
 * @pattern Entity (immutable), Factory Method
 */
import { randomUUID } from 'crypto';
import { ChangeSet } from './ChangeSet';

export type ActorType = 'user' | 'api_key' | 'agent' | 'system' | 'anonymous';

export interface AuditActor {
  type: ActorType;
  userId?: string | null;
  label?: string | null;
  apiKeyId?: string | null;
  agentRole?: string | null;
}

export interface AuditEntryProps {
  id: string;
  timestamp: Date;
  actor: AuditActor;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  projectId?: string | null;
  changes?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
  success: boolean;
  errorMessage?: string | null;
}

export type NewAuditEntry = Omit<AuditEntryProps, 'id' | 'timestamp' | 'success'> & {
  id?: string;
  timestamp?: Date;
  success?: boolean;
};

const ACTION_FORMAT = /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/;

export class AuditEntry {
  private constructor(private readonly props: Readonly<AuditEntryProps>) {}

  static record(input: NewAuditEntry): AuditEntry {
    if (!ACTION_FORMAT.test(input.action)) {
      throw new Error(`Invalid audit action '${input.action}': expected dotted lower-case, e.g. 'project.create'`);
    }
    if (!input.resourceType) throw new Error('Audit entry needs a resource type');
    const changes = input.changes instanceof ChangeSet ? input.changes.toJSON() : ChangeSet.redact(input.changes);
    return new AuditEntry(
      Object.freeze({
        ...input,
        id: input.id ?? randomUUID(),
        timestamp: input.timestamp ?? new Date(),
        success: input.success ?? true,
        changes: changes ?? null,
        errorMessage: input.errorMessage ? input.errorMessage.slice(0, 2000) : null,
        userAgent: input.userAgent ? input.userAgent.slice(0, 500) : null,
      })
    );
  }

  static fromPersistence(props: AuditEntryProps): AuditEntry {
    return new AuditEntry(Object.freeze({ ...props }));
  }

  get id() { return this.props.id; }
  get timestamp() { return this.props.timestamp; }
  get actor() { return this.props.actor; }
  get action() { return this.props.action; }
  get resourceType() { return this.props.resourceType; }
  get resourceId() { return this.props.resourceId ?? null; }
  get projectId() { return this.props.projectId ?? null; }
  get changes() { return this.props.changes ?? null; }
  get ipAddress() { return this.props.ipAddress ?? null; }
  get userAgent() { return this.props.userAgent ?? null; }
  get success() { return this.props.success; }
  get errorMessage() { return this.props.errorMessage ?? null; }

  toPrimitives(): AuditEntryProps {
    return { ...this.props };
  }
}

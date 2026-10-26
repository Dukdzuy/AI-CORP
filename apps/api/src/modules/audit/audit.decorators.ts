import { SetMetadata } from '@nestjs/common';

/**
 * Marks a controller action as audited (Phase 5, Task 21).
 *
 *   @Audited({ action: 'project.update', resourceType: 'Project', idParam: 'id' })
 *
 * The AuditInterceptor writes one entry per call, successful or not. When the resource
 * type has a snapshot loader (see AuditSnapshotRegistry) and `idParam` is given, the entry
 * holds the before/after state and the changed fields; otherwise the sanitised request.
 */
export interface AuditedOptions {
  action: string;
  resourceType: string;
  /** route parameter holding the resource id; otherwise the id of the returned object */
  idParam?: string;
  /** route parameter (or the resource itself, for 'Project') giving the project id */
  projectIdParam?: string;
  /** body field identifying an anonymous caller (login) */
  actorFromBody?: string;
}

export const AUDITED_KEY = 'audit:options';
export const Audited = (options: AuditedOptions) => SetMetadata(AUDITED_KEY, options);

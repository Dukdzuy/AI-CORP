import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, from, lastValueFrom } from 'rxjs';
import { ChangeSet } from '../../domain/audit';
import { AuditLogService } from './audit-log.service';
import { AUDITED_KEY, AuditedOptions } from './audit.decorators';
import { AuditSnapshotRegistry } from './audit-snapshot.registry';

/**
 * Writes one audit entry per call of an @Audited action (Phase 5, Task 21), after the
 * handler finishes, with the outcome. Undecorated routes (reads) are not audited.
 *
 * For a resource with a snapshot loader: before = state loaded before the handler ran,
 * after = state loaded afterwards (null once deleted), diff = changed fields.
 *
 * @pattern Interceptor (AOP), Decorator (metadata)
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly audit: AuditLogService,
    private readonly snapshots: AuditSnapshotRegistry
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const options = this.reflector.get<AuditedOptions>(AUDITED_KEY, context.getHandler());
    if (!options || context.getType() !== 'http') return next.handle();
    return from(this.run(context, next, options));
  }

  private async run(context: ExecutionContext, next: CallHandler, options: AuditedOptions): Promise<unknown> {
    const request = context.switchToHttp().getRequest();
    const paramId: string | undefined = options.idParam ? request.params?.[options.idParam] : undefined;
    const tracked = !!paramId && this.snapshots.supports(options.resourceType);
    const before = tracked ? await this.snapshots.load(options.resourceType, paramId) : null;

    try {
      const result = await lastValueFrom(next.handle(), { defaultValue: undefined });
      const resourceId = paramId ?? (result as any)?.id ?? (result as any)?.apiKey?.id ?? null;
      const after = tracked ? await this.snapshots.load(options.resourceType, paramId) : null;
      await this.audit.record({
        ...this.base(request, options, resourceId, before ?? after, result),
        changes: tracked ? ChangeSet.between(before, after) : this.requestOf(request),
        success: true,
      });
      return result;
    } catch (error) {
      await this.audit.record({
        ...this.base(request, options, paramId ?? null, before),
        changes: this.requestOf(request),
        success: false,
        errorMessage: (error as Error)?.message ?? String(error),
      });
      throw error;
    }
  }

  private requestOf(request: any) {
    const query = request.query && Object.keys(request.query).length ? request.query : undefined;
    const body = request.body && Object.keys(request.body).length ? request.body : undefined;
    return body || query ? { request: body ?? null, ...(query ? { query } : {}) } : null;
  }

  private base(request: any, options: AuditedOptions, resourceId: string | null, resource: unknown, result?: unknown) {
    const bodyActor = options.actorFromBody ? request.body?.[options.actorFromBody] : null;
    // A successful login has no principal yet: the actor is the user it returns
    const loggedIn = !request.principal && (result as any)?.user?.id ? (result as any).user : null;
    let projectId: string | null = null;
    if (options.projectIdParam) projectId = request.params?.[options.projectIdParam] ?? null;
    else if (options.resourceType === 'Project') projectId = resourceId;
    else projectId = (resource as any)?.projectId ?? null;

    return {
      actor: loggedIn
        ? { type: 'user' as const, userId: loggedIn.id, label: loggedIn.email }
        : AuditLogService.actorOf(request.principal, bodyActor ? String(bodyActor).toLowerCase() : null),
      action: options.action,
      resourceType: options.resourceType,
      resourceId,
      projectId,
      ...AuditLogService.requestInfo(request),
    };
  }
}

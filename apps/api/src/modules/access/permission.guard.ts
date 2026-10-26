import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission } from '@ai-corp/shared-types';
import { Principal } from '../../domain/security';
import { AuditLogService } from '../audit/audit-log.service';
import { PERMISSIONS_KEY } from './access.decorators';

/**
 * Permission check (Phase 5, Task 20): the route's @RequirePermission list against the
 * principal's permissions from RolePolicy. A denial is written to the audit log
 * (`access.denied`) before the 403, so probing shows up in anomaly detection.
 */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly audit: AuditLogService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const required = this.reflector.getAllAndOverride<Permission[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) return true;

    const request = context.switchToHttp().getRequest();
    const principal: Principal | undefined = request.principal;
    const missing = required.filter(p => !principal?.can(p));
    if (!missing.length) return true;

    await this.audit.recordDenied(principal, `${request.method} ${request.originalUrl ?? request.url}`, missing.join(', '), request);
    throw new ForbiddenException(`Missing permission: ${missing.join(', ')}`);
  }
}

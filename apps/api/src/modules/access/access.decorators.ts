/**
 * Declarative access rules for controllers (Phase 5, Tasks 20 and 22).
 *
 *   @Public()                       no authentication (login, register, health)
 *   @RequirePermission(P.X, ...)    every listed permission is required
 *   @AllowApiKey()                  the route also accepts `x-api-key`; others accept only a user's JWT
 *   @RateLimit({ limit, windowMs }) per-route limit (API-key routes get a default one)
 *   @CurrentPrincipal()             injects the Principal of the request
 */
import { SetMetadata, createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Permission } from '@ai-corp/shared-types';
import { Principal } from '../../domain/security';

export const IS_PUBLIC_KEY = 'access:public';
export const PERMISSIONS_KEY = 'access:permissions';
export const ALLOW_API_KEY = 'access:allowApiKey';
export const RATE_LIMIT_KEY = 'access:rateLimit';

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
  /** what the window counts: the caller's IP, the principal (user or key), or IP + request body email */
  by?: 'ip' | 'principal' | 'ip_and_email';
}

export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
export const RequirePermission = (...permissions: Permission[]) => SetMetadata(PERMISSIONS_KEY, permissions);
export const AllowApiKey = () => SetMetadata(ALLOW_API_KEY, true);
export const RateLimit = (options: RateLimitOptions) => SetMetadata(RATE_LIMIT_KEY, options);

export const CurrentPrincipal = createParamDecorator((_: unknown, ctx: ExecutionContext): Principal => {
  return ctx.switchToHttp().getRequest().principal;
});

/** IP of the caller as Express sees it (respects `trust proxy` when configured) */
export function clientIp(request: any): string | null {
  return request?.ip || request?.socket?.remoteAddress || null;
}

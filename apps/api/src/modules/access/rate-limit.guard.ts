import { CanActivate, ExecutionContext, HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { IRateLimiter } from '../../domain/integration';
import { Principal } from '../../domain/security';
import { RATE_LIMIT_KEY, RateLimitOptions, clientIp } from './access.decorators';

export const RATE_LIMITER = Symbol('IRateLimiter');

/**
 * Rate limiting (Phase 5, Task 22). Requests made with an API key are limited per key
 * (API_RATE_LIMIT_PER_MINUTE, default 100); routes can declare their own limit with
 * @RateLimit (login uses it against password guessing). Responses carry X-RateLimit-*
 * headers; an exceeded limit answers 429 with Retry-After.
 */
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(RATE_LIMITER) private readonly limiter: IRateLimiter,
    private readonly config: ConfigService
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;
    const request = context.switchToHttp().getRequest();
    const principal: Principal | undefined = request.principal;
    const declared = this.reflector.getAllAndOverride<RateLimitOptions>(RATE_LIMIT_KEY, [context.getHandler(), context.getClass()]);

    let options: RateLimitOptions | undefined = declared;
    if (!options && principal?.kind === 'api_key') {
      options = { limit: Number(this.config.get('API_RATE_LIMIT_PER_MINUTE', 100)), windowMs: 60_000, by: 'principal' };
    }
    if (!options) return true;

    const key = this.keyFor(options, request, principal, context);
    const decision = this.limiter.hit(key, options.limit, options.windowMs);
    const response = context.switchToHttp().getResponse();
    response.setHeader?.('X-RateLimit-Limit', String(decision.limit));
    response.setHeader?.('X-RateLimit-Remaining', String(decision.remaining));
    response.setHeader?.('X-RateLimit-Reset', String(Math.ceil(decision.resetAt / 1000)));
    if (!decision.allowed) {
      response.setHeader?.('Retry-After', String(decision.retryAfterSec));
      throw new HttpException(
        { statusCode: 429, message: `Rate limit exceeded: ${decision.limit} requests per ${Math.round(options.windowMs / 1000)}s` },
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
    return true;
  }

  private keyFor(options: RateLimitOptions, request: any, principal: Principal | undefined, context: ExecutionContext): string {
    const route = `${context.getClass().name}.${context.getHandler().name}`;
    switch (options.by ?? 'principal') {
      case 'ip':
        return `${route}:ip:${clientIp(request)}`;
      case 'ip_and_email':
        return `${route}:ip:${clientIp(request)}:${String(request.body?.email ?? '').toLowerCase()}`;
      default:
        if (principal?.kind === 'api_key') return `key:${principal.apiKeyId}`;
        return `${route}:user:${principal?.userId ?? clientIp(request)}`;
    }
  }
}

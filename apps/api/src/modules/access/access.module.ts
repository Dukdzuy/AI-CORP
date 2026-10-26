import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { InfrastructureModule } from '../../infrastructure/infrastructure.module';
import { FixedWindowRateLimiter } from '../../domain/integration';
import { ApiKeyAuthenticator } from './api-key-authenticator.service';
import { AuthenticationGuard } from './authentication.guard';
import { RateLimitGuard, RATE_LIMITER } from './rate-limit.guard';
import { PermissionGuard } from './permission.guard';
import { AuthorizationService } from './authorization.service';

/**
 * Access control (Phase 5): authentication, rate limiting and permissions are global
 * guards, applied in this order to every HTTP route.
 */
@Global()
@Module({
  imports: [InfrastructureModule],
  providers: [
    ApiKeyAuthenticator,
    AuthorizationService,
    { provide: RATE_LIMITER, useValue: new FixedWindowRateLimiter() },
    { provide: APP_GUARD, useClass: AuthenticationGuard },
    { provide: APP_GUARD, useClass: RateLimitGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
  exports: [AuthorizationService, ApiKeyAuthenticator, RATE_LIMITER],
})
export class AccessModule {}

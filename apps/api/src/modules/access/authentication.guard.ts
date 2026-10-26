import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Principal } from '../../domain/security';
import { ALLOW_API_KEY, IS_PUBLIC_KEY } from './access.decorators';
import { ApiKeyAuthenticator } from './api-key-authenticator.service';

/**
 * Global authentication (Phase 5, Task 20). Every route needs a caller unless it is
 * @Public(). A user authenticates with the JWT from /auth/login (via the existing passport
 * JwtStrategy); an integration authenticates with `x-api-key`, but only on routes marked
 * @AllowApiKey(), so a leaked key can't reach the admin API.
 *
 * Sets `request.principal` (Principal) and keeps `request.user` for existing handlers.
 *
 * @pattern Chain of Responsibility (authentication → rate limit → permission guards)
 */
@Injectable()
export class AuthenticationGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector, private readonly apiKeys: ApiKeyAuthenticator) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'http') return true;
    const targets = [context.getHandler(), context.getClass()];
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, targets)) return true;

    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-api-key'];
    if (apiKey) {
      if (!this.reflector.getAllAndOverride<boolean>(ALLOW_API_KEY, targets)) {
        throw new UnauthorizedException('API keys are only accepted on the integration API (/api/v1)');
      }
      const result = await this.apiKeys.authenticate(String(apiKey));
      if (!result.ok) throw new UnauthorizedException(result.reason);
      request.principal = result.principal;
      request.user = { ...result.principal.user, apiKeyId: result.principal.apiKeyId };
      return true;
    }

    await (super.canActivate(context) as Promise<boolean>);
    request.principal = Principal.forUser(request.user);
    return true;
  }
}

import { Controller, Post, Body, Get } from '@nestjs/common';
import { Principal } from '../../domain/security';
import { CurrentPrincipal, Public, RateLimit } from '../access/access.decorators';
import { Audited } from '../audit/audit.decorators';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @RateLimit({ limit: 5, windowMs: 60_000, by: 'ip' })
  @Audited({ action: 'auth.register', resourceType: 'User', actorFromBody: 'email' })
  async register(@Body() data: RegisterDto) {
    return this.authService.register(data);
  }

  /** Limited per IP + email against password guessing; failures feed anomaly detection */
  @Public()
  @Post('login')
  @RateLimit({ limit: 10, windowMs: 60_000, by: 'ip_and_email' })
  @Audited({ action: 'auth.login', resourceType: 'Auth', actorFromBody: 'email' })
  async login(@Body() data: LoginDto) {
    return this.authService.login(data);
  }

  /** The signed-in user with the permissions the web app uses to show or hide actions */
  @Get('me')
  me(@CurrentPrincipal() principal: Principal) {
    return { ...principal.user, permissions: principal.listPermissions() };
  }
}

import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== 'ws') {
      return true;
    }

    const client: Socket = context.switchToWs().getClient();
    const token = this.extractTokenFromClient(client);

    if (!token) {
      this.logger.warn('WebSocket connection missing JWT token');
      return false;
    }

    try {
      const secret = this.configService.get<string>('JWT_SECRET', 'super-secret-fallback-key');
      const payload = this.jwtService.verify(token, { secret });
      
      // Attach user to the socket data
      client.data.user = payload;
      return true;
    } catch (error) {
      this.logger.error(`WebSocket authentication failed: ${(error as Error).message}`);
      return false;
    }
  }

  private extractTokenFromClient(client: Socket): string | null {
    const authHeader = client.handshake?.headers?.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    
    const authToken = client.handshake?.auth?.token;
    if (authToken) {
      return authToken;
    }

    return null;
  }
}

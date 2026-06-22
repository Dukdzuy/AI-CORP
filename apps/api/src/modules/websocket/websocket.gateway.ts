import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppWebSocketGateway.name);

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway Initialized');
  }

  handleConnection(client: Socket) {
    try {
      const authHeader = client.handshake.auth?.token || client.handshake.headers['authorization'];
      if (!authHeader) {
        throw new Error('Missing authorization token');
      }

      const token = authHeader.replace('Bearer ', '');
      // In production, use ConfigService for JWT_SECRET
      const secret = process.env.JWT_SECRET || 'fallback_secret';
      
      const decoded = jwt.verify(token, secret) as any;
      // Attach user info to socket
      (client as any).user = decoded;

      // Join user-specific room
      const userId = decoded.sub || decoded.userId || decoded.id;
      if (userId) {
        client.join(`user_${userId}`);
      }

      this.logger.log(`Client connected: ${client.id}, User ID: ${userId}`);
    } catch (error: any) {
      this.logger.warn(`Unauthorized connection attempt: ${client.id} - ${error.message}`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client disconnected: ${client.id}`);
    // Socket.io automatically removes the client from rooms upon disconnect.
  }

  @SubscribeMessage('subscribe_project')
  handleSubscribeProject(@ConnectedSocket() client: Socket, @MessageBody() data: { projectId: string }) {
    if (!data || !data.projectId) {
      return { status: 'error', message: 'projectId is required' };
    }
    
    // Add client to the project's room
    client.join(data.projectId);
    this.logger.log(`Client ${client.id} subscribed to project ${data.projectId}`);
    
    return { status: 'success', event: 'subscribed', projectId: data.projectId };
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcastEvent(event: any) {
    this.server.emit('system_event', event);
  }

  /**
   * Send an event to a specific project room
   * Emits both the specific event type and project_event for backwards compatibility
   */
  sendToProject(projectId: string, event: any) {
    // Emit the specific event type directly (e.g., 'agent:thinking')
    if (event.type && event.payload) {
      this.server.to(projectId).emit(event.type, event.payload);
    }
    // Also emit as project_event for general listeners
    this.server.to(projectId).emit('project_event', event);
  }

  /**
   * Send an event to a specific user
   */
  sendToUser(userId: string, event: any) {
    this.server.to(`user_${userId}`).emit('user_event', event);
  }
}

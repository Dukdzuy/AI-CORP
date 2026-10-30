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
import { Logger, Inject, forwardRef, OnModuleInit } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { corsOrigins, jwtSecret } from '../security/runtime-config';

@WebSocketGateway({
  cors: {
    origin: corsOrigins(),
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
      const decoded = jwt.verify(token, jwtSecret()) as any;
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

  /** The web app sends `{ projectId }`; a bare id string is accepted too */
  @SubscribeMessage('subscribe_project')
  handleSubscribeProject(@ConnectedSocket() client: Socket, @MessageBody() data: { projectId: string } | string) {
    const projectId = typeof data === 'string' ? data : data?.projectId;
    if (!projectId) {
      return { status: 'error', message: 'projectId is required' };
    }

    // Add client to the project's room
    client.join(projectId);
    this.logger.log(`Client ${client.id} subscribed to project ${projectId}`);

    return { status: 'success', event: 'subscribed', projectId };
  }

  @SubscribeMessage('unsubscribe_project')
  handleUnsubscribeProject(@ConnectedSocket() client: Socket, @MessageBody() data: { projectId: string } | string) {
    const projectId = typeof data === 'string' ? data : data?.projectId;
    if (!projectId) {
      return { status: 'error', message: 'projectId is required' };
    }
    client.leave(projectId);
    return { status: 'success', event: 'unsubscribed', projectId };
  }

  /**
   * Approvals are answered through POST /api/approvals/:id/approve|reject only. This socket
   * message used to approve or reject any approval for any connected user, skipping the
   * APPROVAL_GRANT permission, the assignee check and the audit log (found in Phase 7).
   */
  @SubscribeMessage('human:approval_response')
  handleApprovalResponse(@ConnectedSocket() client: Socket, @MessageBody() data: { approvalId?: string }) {
    const userId = (client as any).user?.sub;
    this.logger.warn(`Refused approval response over WebSocket for ${data?.approvalId} from user ${userId}`);
    return { status: 'error', message: 'Answer approvals with POST /api/approvals/:id/approve or /reject' };
  }

  /**
   * Broadcast an event to all connected clients
   */
  broadcastEvent(event: any) {
    this.server.emit('system_event', event);
  }

  /**
   * Send an event to a specific project room
   * Emits both the specific event type AND project_event for general listeners
   */
  sendToProject(projectId: string, event: any) {
    // Emit the specific event type directly (e.g., 'agent:thinking', 'human:approval_required')
    // Events carry their body in `data` (most) or `payload` (agent thinking / state changes)
    if (event.type) {
      this.server.to(projectId).emit(event.type, event.data ?? event.payload ?? event);
    }
    // Also emit as project_event for general listeners
    this.server.to(projectId).emit('project_event', event);
  }

  /**
   * Send an event to a specific user
   * Emits both the specific event type AND user_event for general listeners
   */
  sendToUser(userId: string, event: any) {
    // Emit the specific event type directly (e.g., 'human:approval_required')
    if (event.type) {
      this.server.to(`user_${userId}`).emit(event.type, event.data ?? event);
    }
    // Also emit as user_event for general listeners
    this.server.to(`user_${userId}`).emit('user_event', event);
  }

  /**
   * Send an event to both a project room and a specific user
   * Used for approval events that need to reach both the project page and notification bell
   */
  sendToProjectAndUser(projectId: string, userId: string, event: any) {
    this.sendToProject(projectId, event);
    this.sendToUser(userId, event);
  }
}

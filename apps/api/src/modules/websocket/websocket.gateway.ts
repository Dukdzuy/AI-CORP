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
import { Logger, Inject, forwardRef, OnModuleInit, OnApplicationBootstrap } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
})
export class AppWebSocketGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect, OnApplicationBootstrap {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(AppWebSocketGateway.name);
  private approvalService: any = null;

  constructor(private readonly moduleRef: ModuleRef) {}

  onApplicationBootstrap() {
    try {
      const { ApprovalService } = require('../approvals/approval.service');
      this.approvalService = this.moduleRef.get(ApprovalService, { strict: false });
      this.logger.log('ApprovalService wired into WebSocket gateway');
    } catch (e: any) {
      this.logger.warn(`Could not wire ApprovalService: ${e.message}`);
    }
  }

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

  @SubscribeMessage('human:approval_response')
  async handleApprovalResponse(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { approvalId: string; status: 'approved' | 'rejected'; comment?: string; respondedAt?: string }
  ) {
    this.logger.log(`Received approval response: ${data.approvalId} -> ${data.status}`);

    if (!this.approvalService) {
      this.logger.error('ApprovalService not initialized');
      return { status: 'error', message: 'Approval service not available' };
    }

    try {
      const result = await this.approvalService.handleApprovalResponse(
        data.approvalId,
        data.status,
        data.comment
      );
      return { status: 'success', approval: result };
    } catch (error: any) {
      this.logger.error(`Approval response failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }
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
    if (event.type) {
      this.server.to(projectId).emit(event.type, event.data ?? event);
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

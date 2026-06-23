import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { WebSocketEventType } from '@ai-corp/shared-types';

export interface SendMessageParams {
  projectId: string;
  fromRole: string;
  toRole?: string | null;
  message: string;
  messageType?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class AgentMessageService {
  private readonly logger = new Logger(AgentMessageService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocketGateway: AppWebSocketGateway,
  ) {}

  async sendMessage(params: SendMessageParams) {
    // Look up agent ID by role
    const agent = await this.prisma.agent.findUnique({
      where: { role: params.fromRole },
    });

    if (!agent) {
      throw new Error(`Agent with role ${params.fromRole} not found in database.`);
    }

    // Sanitize message and metadata to remove null bytes (PostgreSQL rejects \u0000)
    const sanitizedMessage = this.sanitizeForPostgres(params.message);
    const sanitizedMetadata = params.metadata ? this.sanitizeJsonForPostgres(params.metadata) : {};

    const record = await this.prisma.agentMessage.create({
      data: {
        projectId: params.projectId,
        fromAgentId: agent.id,
        fromRole: params.fromRole,
        toRole: params.toRole,
        message: sanitizedMessage,
        messageType: params.messageType || 'chat',
        metadata: sanitizedMetadata,
      },
    });

    // Emit WebSocket event
    this.websocketGateway.sendToProject(params.projectId, {
      type: WebSocketEventType.AGENT_MESSAGE,
      data: record,
      timestamp: new Date(),
    } as any);

    return record;
  }

  private sanitizeForPostgres(str: string): string {
    if (!str) return '';
    // Remove null bytes and other problematic Unicode characters
    return str.replace(/\u0000/g, '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  private sanitizeJsonForPostgres(obj: any): any {
    if (typeof obj === 'string') return this.sanitizeForPostgres(obj);
    if (Array.isArray(obj)) return obj.map(item => this.sanitizeJsonForPostgres(item));
    if (obj && typeof obj === 'object') {
      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.sanitizeJsonForPostgres(value);
      }
      return result;
    }
    return obj;
  }
}

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

    const record = await this.prisma.agentMessage.create({
      data: {
        projectId: params.projectId,
        fromAgentId: agent.id,
        fromRole: params.fromRole,
        toRole: params.toRole,
        message: params.message,
        messageType: params.messageType || 'chat',
        metadata: params.metadata || {},
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
}

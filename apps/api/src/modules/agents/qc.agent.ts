import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { EventBus } from '../../domain/events/EventBus';
import { QcOutput } from '../../domain/agent/AgentOutputs';
import { QcThinkingStrategy, QcActionStrategy } from './strategies';
import { QC_PROFILE } from './profiles';

@Injectable()
export class QcAgent extends BaseAgent<QcOutput> {
  constructor(
    thinkingStrategy: QcThinkingStrategy,
    actionStrategy: QcActionStrategy,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus
  ) {
    super(QC_PROFILE, thinkingStrategy, actionStrategy, websocketGateway, eventBus);
  }
}

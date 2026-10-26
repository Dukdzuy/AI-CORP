import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { EventBus } from '../../domain/events/EventBus';
import { QaOutput } from '../../domain/agent/AgentOutputs';
import { QaThinkingStrategy, QaActionStrategy } from './strategies';
import { QA_PROFILE } from './profiles';

@Injectable()
export class QaAgent extends BaseAgent<QaOutput> {
  constructor(
    thinkingStrategy: QaThinkingStrategy,
    actionStrategy: QaActionStrategy,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus
  ) {
    super(QA_PROFILE, thinkingStrategy, actionStrategy, websocketGateway, eventBus);
  }
}

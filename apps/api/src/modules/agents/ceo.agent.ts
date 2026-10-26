import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { EventBus } from '../../domain/events/EventBus';
import { CeoOutput } from '../../domain/agent/AgentOutputs';
import { CeoThinkingStrategy, CeoActionStrategy } from './strategies';
import { CEO_PROFILE } from './profiles';

@Injectable()
export class CeoAgent extends BaseAgent<CeoOutput> {
  constructor(
    thinkingStrategy: CeoThinkingStrategy,
    actionStrategy: CeoActionStrategy,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus
  ) {
    super(CEO_PROFILE, thinkingStrategy, actionStrategy, websocketGateway, eventBus);
  }
}

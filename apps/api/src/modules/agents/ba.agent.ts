import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { EventBus } from '../../domain/events/EventBus';
import { BaOutput } from '../../domain/agent/AgentOutputs';
import { BAThinkingStrategy, BAActionStrategy } from './strategies';
import { BA_PROFILE } from './profiles';

@Injectable()
export class BaAgent extends BaseAgent<BaOutput> {
  constructor(
    thinkingStrategy: BAThinkingStrategy,
    actionStrategy: BAActionStrategy,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus
  ) {
    super(BA_PROFILE, thinkingStrategy, actionStrategy, websocketGateway, eventBus);
  }
}

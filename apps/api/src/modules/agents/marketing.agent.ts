import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { EventBus } from '../../domain/events/EventBus';
import { MarketingOutput } from '../../domain/agent/AgentOutputs';
import { MarketingThinkingStrategy, MarketingActionStrategy } from './strategies';
import { MARKETING_PROFILE } from './profiles';

@Injectable()
export class MarketingAgent extends BaseAgent<MarketingOutput> {
  constructor(
    thinkingStrategy: MarketingThinkingStrategy,
    actionStrategy: MarketingActionStrategy,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus
  ) {
    super(MARKETING_PROFILE, thinkingStrategy, actionStrategy, websocketGateway, eventBus);
  }
}

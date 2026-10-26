import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { EventBus } from '../../domain/events/EventBus';
import { PmOutput } from '../../domain/agent/AgentOutputs';
import { PmThinkingStrategy, PmActionStrategy } from './strategies';
import { PM_PROFILE } from './profiles';

@Injectable()
export class PmAgent extends BaseAgent<PmOutput> {
  constructor(
    thinkingStrategy: PmThinkingStrategy,
    actionStrategy: PmActionStrategy,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus
  ) {
    super(PM_PROFILE, thinkingStrategy, actionStrategy, websocketGateway, eventBus);
  }
}

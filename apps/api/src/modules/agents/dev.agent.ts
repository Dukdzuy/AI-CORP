import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { EventBus } from '../../domain/events/EventBus';
import { DevOutput } from '../../domain/agent/AgentOutputs';
import { DevThinkingStrategy, DevActionStrategy } from './strategies';
import { DEV_PROFILE } from './profiles';

@Injectable()
export class DevAgent extends BaseAgent<DevOutput> {
  constructor(
    thinkingStrategy: DevThinkingStrategy,
    actionStrategy: DevActionStrategy,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus
  ) {
    super(DEV_PROFILE, thinkingStrategy, actionStrategy, websocketGateway, eventBus);
  }
}

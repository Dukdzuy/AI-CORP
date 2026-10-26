import { Injectable } from '@nestjs/common';
import { BaseAgent } from './base.agent';
import { AppWebSocketGateway } from '../websocket/websocket.gateway';
import { EventBus } from '../../domain/events/EventBus';
import { ArchitectOutput } from '../../domain/agent/AgentOutputs';
import { ArchitectThinkingStrategy, ArchitectActionStrategy } from './strategies';
import { ARCHITECT_PROFILE } from './profiles';

@Injectable()
export class ArchitectAgent extends BaseAgent<ArchitectOutput> {
  constructor(
    thinkingStrategy: ArchitectThinkingStrategy,
    actionStrategy: ArchitectActionStrategy,
    websocketGateway: AppWebSocketGateway,
    eventBus: EventBus
  ) {
    super(ARCHITECT_PROFILE, thinkingStrategy, actionStrategy, websocketGateway, eventBus);
  }
}

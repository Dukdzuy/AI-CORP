import { Module } from '@nestjs/common';
import { AppWebSocketGateway } from './websocket.gateway';

@Module({
  providers: [AppWebSocketGateway],
  exports: [AppWebSocketGateway],
})
export class WebSocketModule {}

import { Module } from '@nestjs/common';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { WebsocketModule } from '../websocket/websocket.module';
import { ServerPowerService } from './server-power.service';
import { ServerOutboundMessagingService } from '../server-outbound/server-outbound-messaging.service';

@Module({
  imports: [WebsocketModule],
  controllers: [ServerController],
  providers: [
    ServerService,
    ServerPowerService,
    ServerOutboundMessagingService,
  ],
})
export class ServerModule {}

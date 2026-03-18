import { Module } from '@nestjs/common';
import { ServerCommandsService } from './server-commands.service';
import { ServerCommandsController } from './server-commands.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { ServerOutboundMessagingModule } from '../server-outbound/server-outbound-messaging.module';

@Module({
  imports: [ServerOutboundMessagingModule, WebsocketModule],
  providers: [ServerCommandsService],
  controllers: [ServerCommandsController],
})
export class ServerCommandsModule {}

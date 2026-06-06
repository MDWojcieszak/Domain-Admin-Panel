import { Module } from '@nestjs/common';
import { ServerCommandsService } from './server-commands.service';
import { CommandProgressMarkerService } from './command-progress-marker.service';
import { ServerCommandsController } from './server-commands.controller';
import { WebsocketModule } from '../websocket/websocket.module';
import { ServerOutboundMessagingModule } from '../server-outbound/server-outbound-messaging.module';
import { ServerProcessModule } from '../server-process/server-process.module';

@Module({
  imports: [
    ServerOutboundMessagingModule,
    WebsocketModule,
    ServerProcessModule,
  ],
  providers: [ServerCommandsService, CommandProgressMarkerService],
  controllers: [ServerCommandsController],
})
export class ServerCommandsModule {}

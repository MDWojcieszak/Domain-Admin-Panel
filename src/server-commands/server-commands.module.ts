import { Module } from '@nestjs/common';
import { ServerCommandsService } from './server-commands.service';
import { CommandProgressMarkerService } from './command-progress-marker.service';
import { ServerCommandsController } from './server-commands.controller';
import { ServerOutboundMessagingModule } from '../server-outbound/server-outbound-messaging.module';
import { ServerProcessModule } from '../server-process/server-process.module';

@Module({
  imports: [ServerOutboundMessagingModule, ServerProcessModule],
  providers: [ServerCommandsService, CommandProgressMarkerService],
  controllers: [ServerCommandsController],
})
export class ServerCommandsModule {}

import { Module } from '@nestjs/common';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { MultiVerseModule } from '../multi-verse/multi-verse.module';
import { WebsocketModule } from '../websocket/websocket.module';
import { ServerPowerService } from './server-power.service';

@Module({
  imports: [MultiVerseModule, WebsocketModule],
  controllers: [ServerController],
  providers: [ServerService, ServerPowerService],
})
export class ServerModule {}

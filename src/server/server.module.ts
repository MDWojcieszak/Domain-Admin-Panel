import { Module } from '@nestjs/common';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { MultiVerseModule } from '../multi-verse/multi-verse.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [MultiVerseModule, WebsocketModule],
  controllers: [ServerController],
  providers: [ServerService],
})
export class ServerModule {}

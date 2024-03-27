import { Module } from '@nestjs/common';
import { ServerCommandsService } from './server-commands.service';
import { ServerCommandsController } from './server-commands.controller';
import { MultiVerseModule } from '../multi-verse/multi-verse.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [MultiVerseModule, WebsocketModule],
  providers: [ServerCommandsService],
  controllers: [ServerCommandsController],
})
export class ServerCommandsModule {}

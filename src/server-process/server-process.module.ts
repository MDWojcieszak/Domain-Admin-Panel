import { Module } from '@nestjs/common';
import { ServerProcessController } from './server-process.controller';
import { ServerProcessService } from './server-process.service';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [WebsocketModule],
  controllers: [ServerProcessController],
  providers: [ServerProcessService],
  exports: [ServerProcessService],
})
export class ServerProcessModule {}

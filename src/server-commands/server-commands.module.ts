import { Module } from '@nestjs/common';
import { ServerCommandsService } from './server-commands.service';
import { ServerCommandsController } from './server-commands.controller';

@Module({
  providers: [ServerCommandsService],
  controllers: [ServerCommandsController]
})
export class ServerCommandsModule {}

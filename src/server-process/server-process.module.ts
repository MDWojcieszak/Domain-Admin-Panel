import { Module } from '@nestjs/common';
import { ServerProcessController } from './server-process.controller';
import { ServerProcessService } from './server-process.service';

@Module({
  controllers: [ServerProcessController],
  providers: [ServerProcessService]
})
export class ServerProcessModule {}

import { Module } from '@nestjs/common';
import { ServerController } from './server.controller';
import { ServerService } from './server.service';
import { MultiVerseModule } from '../multi-verse/multi-verse.module';

@Module({
  imports: [MultiVerseModule],
  controllers: [ServerController],
  providers: [ServerService],
})
export class ServerModule {}

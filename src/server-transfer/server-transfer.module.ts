import { Module } from '@nestjs/common';
import { ServerTransferService } from './server-transfer.service';
import { MultiVerseModule } from '../multi-verse/multi-verse.module';
import { ServerTransferController } from './server-transfer.controller';

@Module({
  imports: [MultiVerseModule],
  controllers: [ServerTransferController],
  providers: [ServerTransferService],
})
export class ServerTransferModule {}

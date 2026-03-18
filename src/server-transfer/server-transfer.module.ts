import { Module } from '@nestjs/common';
import { ServerTransferService } from './server-transfer.service';
import { ServerTransferController } from './server-transfer.controller';
import { ServerOutboundMessagingModule } from '../server-outbound/server-outbound-messaging.module';

@Module({
  imports: [ServerOutboundMessagingModule],
  controllers: [ServerTransferController],
  providers: [ServerTransferService],
})
export class ServerTransferModule {}

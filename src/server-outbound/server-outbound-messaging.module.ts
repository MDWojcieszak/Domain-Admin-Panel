import { Module } from '@nestjs/common';
import { ServerOutboundMessagingService } from './server-outbound-messaging.service';

@Module({
  providers: [ServerOutboundMessagingService],
  exports: [ServerOutboundMessagingService],
})
export class ServerOutboundMessagingModule {}

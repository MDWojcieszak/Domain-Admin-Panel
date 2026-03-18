import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ServerOutboundMessagingService } from './server-outbound-messaging.service';

@Module({
  providers: [ServerOutboundMessagingService],
  exports: [ServerOutboundMessagingService],
})
export class ServerOutboundMessagingModule {}

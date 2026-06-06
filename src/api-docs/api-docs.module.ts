import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { MessagingDocsService } from './messaging-docs.service';

@Module({
  imports: [DiscoveryModule],
  providers: [MessagingDocsService],
  exports: [MessagingDocsService],
})
export class ApiDocsModule {}

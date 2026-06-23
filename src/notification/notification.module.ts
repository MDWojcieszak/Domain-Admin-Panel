import { Module } from '@nestjs/common';

import { MailModule } from '../mail/mail.module';
import { NotificationService } from './notification.service';
import { NotificationController } from './notification.controller';

/** Shared email-notification helper (server status, process failure, idle). */
@Module({
  imports: [MailModule],
  controllers: [NotificationController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}

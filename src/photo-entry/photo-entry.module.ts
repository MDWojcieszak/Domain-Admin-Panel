import { Module } from '@nestjs/common';
import { PhotoEntryController } from './photo-entry.controller';
import { PhotoEntryService } from './photo-entry.service';
import { PhotoStorageService } from '../photo-storage-service/photo-storage.service';
import { NotificationModule } from '../notification/notification.module';
import { PhotoEntryGearController } from './gear/photo-entry-gear.controller';
import { PhotoEntryGearService } from './gear/photo-entry-gear.service';
import { PendingMediaReminderService } from './gear/pending-media-reminder.service';
import { PhotoEntryCommentController } from './comments/photo-entry-comment.controller';
import { PhotoEntryCommentService } from './comments/photo-entry-comment.service';
import { PhotoEntryCountsService } from './counts/photo-entry-counts.service';

@Module({
  imports: [NotificationModule],
  // Sub-resource controllers FIRST: they own static paths such as GET
  // /photo-entry/pending-media and /photo-entry/comments/:commentId, which the
  // :id routes would otherwise swallow — Nest registers in controller order.
  controllers: [
    PhotoEntryGearController,
    PhotoEntryCommentController,
    PhotoEntryController,
  ],
  providers: [
    PhotoEntryService,
    PhotoEntryGearService,
    PhotoEntryCommentService,
    PhotoEntryCountsService,
    PendingMediaReminderService,
    PhotoStorageService,
  ],
})
export class PhotoEntryModule {}

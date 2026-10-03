import { Module } from '@nestjs/common';
import { PhotoEntryController } from './photo-entry.controller';
import { PhotoEntryService } from './photo-entry.service';
import { PhotoStorageService } from '../photo-storage-service/photo-storage.service';
import { NotificationModule } from '../notification/notification.module';
import { GearModule } from '../gear/gear.module';
import { GalleriesModule } from '../galleries/galleries.module';
import { PhotoEntryPlanningController } from './planning/planning.controller';
import { AttentionService } from './planning/attention.service';
import { TripReminderService } from './planning/trip-reminder.service';
import { PhotoEntryGearController } from './gear/photo-entry-gear.controller';
import { PhotoEntryGearService } from './gear/photo-entry-gear.service';
import { PendingMediaReminderService } from './gear/pending-media-reminder.service';
import { PhotoEntryCommentController } from './comments/photo-entry-comment.controller';
import { PhotoEntryCommentService } from './comments/photo-entry-comment.service';
import { PhotoEntryCountsService } from './counts/photo-entry-counts.service';

@Module({
  imports: [NotificationModule, GearModule],
  // Sub-resource controllers FIRST: they own static paths such as GET
  // /photo-entry/pending-media and /photo-entry/comments/:commentId, which the
  // :id routes would otherwise swallow — Nest registers in controller order.
  controllers: [
    PhotoEntryGearController,
    PhotoEntryCommentController,
    PhotoEntryPlanningController,
    PhotoEntryController,
  ],
  providers: [
    PhotoEntryService,
    PhotoEntryGearService,
    PhotoEntryCommentService,
    PhotoEntryCountsService,
    PendingMediaReminderService,
    AttentionService,
    TripReminderService,
    PhotoStorageService,
  ],
})
export class PhotoEntryModule {}

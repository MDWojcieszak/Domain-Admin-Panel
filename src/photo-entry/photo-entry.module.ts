import { Module } from '@nestjs/common';
import { PhotoEntryController } from './photo-entry.controller';
import { PhotoEntryService } from './photo-entry.service';
import { PhotoStorageService } from '../photo-storage-service/photo-storage.service';
import { NotificationModule } from '../notification/notification.module';
import { PhotoEntryGearController } from './gear/photo-entry-gear.controller';
import { PhotoEntryGearService } from './gear/photo-entry-gear.service';
import { PendingMediaReminderService } from './gear/pending-media-reminder.service';

@Module({
  imports: [NotificationModule],
  // Gear controller FIRST: it owns static paths such as GET
  // /photo-entry/pending-media, which GET /photo-entry/:id would otherwise
  // swallow — Nest registers routes in controller order.
  controllers: [PhotoEntryGearController, PhotoEntryController],
  providers: [
    PhotoEntryService,
    PhotoEntryGearService,
    PendingMediaReminderService,
    PhotoStorageService,
  ],
})
export class PhotoEntryModule {}

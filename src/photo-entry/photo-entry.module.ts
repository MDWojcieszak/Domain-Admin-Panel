import { Module } from '@nestjs/common';
import { PhotoEntryController } from './photo-entry.controller';
import { PhotoEntryService } from './photo-entry.service';
import { PhotoStorageService } from '../photo-storage-service/photo-storage.service';
import { PhotoEntryGearController } from './gear/photo-entry-gear.controller';
import { PhotoEntryGearService } from './gear/photo-entry-gear.service';

@Module({
  controllers: [PhotoEntryController, PhotoEntryGearController],
  providers: [PhotoEntryService, PhotoEntryGearService, PhotoStorageService],
})
export class PhotoEntryModule {}

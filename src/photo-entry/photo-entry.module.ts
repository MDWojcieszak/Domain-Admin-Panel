import { Module } from '@nestjs/common';
import { PhotoEntryController } from './photo-entry.controller';
import { PhotoEntryService } from './photo-entry.service';
import { PhotoStorageService } from '../photo-storage-service/photo-storage.service';

@Module({
  controllers: [PhotoEntryController],
  providers: [PhotoEntryService, PhotoStorageService],
})
export class PhotoEntryModule {}

import { Module } from '@nestjs/common';
import { AstroObjectController } from './astro-object.controller';
import { AstroObjectService } from './astro-object.service';
import { PhotoStorageService } from '../photo-storage-service/photo-storage.service';

@Module({
  controllers: [AstroObjectController],
  providers: [AstroObjectService, PhotoStorageService],
})
export class AstroObjectModule {}

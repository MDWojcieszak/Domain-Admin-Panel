import { Module } from '@nestjs/common';
import { ImageController } from './image.controller';
import { ImageService } from './image.service';
import { FileService } from '../file/file.service';

@Module({
  controllers: [ImageController],
  providers: [ImageService, FileService],
})
export class ImageModule {}

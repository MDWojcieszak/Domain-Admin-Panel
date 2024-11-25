import { Controller, Get, Query, Res } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { PHOTO_SIZE, PhotoDto } from './dto';
import { Response } from 'express';

@ApiTags('Gallery')
@Controller('gallery')
export class GalleryController {
  constructor(private galleryService: GalleryService) {}

  @Public()
  @Get('all')
  async getAll() {
    return this.galleryService.getAll();
  }
  @Public()
  @Get('cover')
  async getCoverImage(@Query() dto: PhotoDto, @Res() res: Response) {
    const file = await this.galleryService.readImage(dto.id, PHOTO_SIZE.COVER);
    file.pipe(res);
  }

  @Public()
  @Get('low-res')
  async getLowResImage(@Query() dto: PhotoDto, @Res() res: Response) {
    const file = await this.galleryService.readImage(
      dto.id,
      PHOTO_SIZE.LOW_RES,
    );
    file.pipe(res);
  }
}

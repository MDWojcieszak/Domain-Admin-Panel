import { Controller, Get, Query, Res } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { PHOTO_SIZE, PhotoDto } from './dto';
import { Response } from 'express';

// NOTE: the public flat dump `GET /gallery/all` was removed — it leaked every
// gallery image regardless of publish state. Public listings now go through the
// curated portfolio API (`/portfolio/...`), which only returns PUBLISHED
// galleries. The single-image streams below stay (referenced by `?id=`).
@ApiTags('Gallery')
@Controller('gallery')
export class GalleryController {
  constructor(private galleryService: GalleryService) {}

  @Public()
  @Get('cover')
  @ApiQuery({ name: 'id', type: String, required: true })
  async getCoverImage(
    @Query() dto: PhotoDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.galleryService.readImage(dto.id, PHOTO_SIZE.COVER);
    file.pipe(res);
  }

  @Public()
  @Get('low-res')
  @ApiQuery({ name: 'id', type: String, required: true })
  async getLowResImage(
    @Query() dto: PhotoDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.galleryService.readImage(
      dto.id,
      PHOTO_SIZE.LOW_RES,
    );
    file.pipe(res);
  }
}

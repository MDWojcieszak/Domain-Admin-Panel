import { Controller, Get, Query, Res } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { ApiOkResponse, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { PHOTO_SIZE, PhotoDto } from './dto';
import { Response } from 'express';
import { GalleryResponseDto } from './responses';

@ApiTags('Gallery')
@Controller('gallery')
export class GalleryController {
  constructor(private galleryService: GalleryService) {}

  @Public()
  @Get('all')
  @ApiOkResponse({ type: GalleryResponseDto })
  async getAll(): Promise<GalleryResponseDto> {
    return this.galleryService.getAll();
  }

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

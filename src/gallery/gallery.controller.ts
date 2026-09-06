import { Controller, Get, Query, Res } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import {
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { streamFileToResponse } from '../common/helpers/stream-file.helper';
import { PHOTO_SIZE, PhotoDto } from './dto';
import { Response } from 'express';
import { GalleryResponseDto } from './responses';

/**
 * Legacy gallery API, kept alive so the original front-end (now the "project
 * history" view) keeps working next to the new portfolio. Every route here is
 * frozen — same paths, same query params, same response shapes — and marked
 * deprecated in the OpenAPI spec.
 *
 * New clients should use:
 *   - `GET /portfolio/galleries` / `/portfolio/galleries/:slug` instead of `/gallery/all`
 *   - `GET /image/cover` / `GET /image/low-res` instead of `/gallery/cover` / `/gallery/low-res`
 */
@ApiTags('Gallery (deprecated)')
@Controller('gallery')
export class GalleryController {
  constructor(private galleryService: GalleryService) {}

  @Public()
  @Get('all')
  @ApiOperation({
    deprecated: true,
    summary: 'Flat listing of published gallery images (legacy)',
    description:
      'Superseded by `GET /portfolio/galleries`. Returns only images belonging ' +
      'to a PUBLISHED gallery and not marked HIDDEN there — unlike the original ' +
      'implementation, which dumped every gallery image regardless of state.',
  })
  @ApiOkResponse({ type: GalleryResponseDto })
  async getAll(): Promise<GalleryResponseDto> {
    return this.galleryService.getAll();
  }

  @Public()
  @Get('cover')
  @ApiOperation({
    deprecated: true,
    summary: 'Cover image stream (legacy)',
    description: 'Superseded by `GET /image/cover`. Identical output.',
  })
  @ApiQuery({ name: 'id', type: String, required: true })
  async getCoverImage(
    @Query() dto: PhotoDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.galleryService.readImage(dto.id, PHOTO_SIZE.COVER);
    streamFileToResponse(file, res);
  }

  @Public()
  @Get('low-res')
  @ApiOperation({
    deprecated: true,
    summary: 'Low-resolution image stream (legacy)',
    description: 'Superseded by `GET /image/low-res`. Identical output.',
  })
  @ApiQuery({ name: 'id', type: String, required: true })
  async getLowResImage(
    @Query() dto: PhotoDto,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.galleryService.readImage(
      dto.id,
      PHOTO_SIZE.LOW_RES,
    );
    streamFileToResponse(file, res);
  }
}

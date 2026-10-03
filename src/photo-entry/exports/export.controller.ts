import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { createReadStream } from 'fs';

import { PERMISSIONS } from '../../common/acl/permissions';
import {
  GetCurrentUser,
  Public,
  RequirePermissions,
} from '../../common/decorators';
import { streamFileToResponse } from '../../common/helpers/stream-file.helper';
import { ExportPreviewQueryDto, PublishExportsDto } from './dto';
import { ExportService } from './export.service';
import { ExportScanResponse, PublishExportsResponse } from './responses';

/** Publishing from the entry's export folder (§2 of the planning doc). */
@ApiTags('Photo Entry')
@Controller('photo-entry')
export class PhotoEntryExportController {
  constructor(private readonly exports: ExportService) {}

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @Get(':id/exports')
  @ApiOperation({
    summary: 'Scan the export folder',
    description:
      'Lists 04_EXPORT on demand with each file’s publication status ' +
      '(NEW, PENDING, PUBLISHED, CHANGED, FAILED) and signed preview URLs ' +
      'valid ~1 h — use them directly in <img loading="lazy">. GENERAL and ' +
      'WORK entries with created folders only.',
  })
  @ApiOkResponse({ type: ExportScanResponse })
  scan(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<ExportScanResponse> {
    return this.exports.scan(userId, id);
  }

  /**
   * No session on purpose: an <img> cannot send a bearer token. The signed,
   * expiring URL issued by an authorised scan is the authorisation (Q3).
   */
  @Public()
  @Get(':id/exports/preview')
  @ApiProduces('image/webp')
  @ApiOperation({
    summary: 'Preview of an export file (signed URL)',
    description:
      'Do not build this URL — take thumbUrl / previewUrl from the scan.',
  })
  async preview(
    @Param('id') id: string,
    @Query() query: ExportPreviewQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const path = await this.exports.preview(id, query);
    res.setHeader('Content-Type', 'image/webp');
    // private: shared caches must never keep unpublished photos.
    res.setHeader('Cache-Control', 'private, max-age=3600');
    streamFileToResponse(createReadStream(path), res);
  }

  @ApiBearerAuth()
  @RequirePermissions(
    PERMISSIONS.PHOTO_ENTRY_MANAGE,
    PERMISSIONS.GALLERY_MANAGE,
  )
  @Post(':id/exports/publish')
  @HttpCode(202)
  @ApiOperation({
    summary: 'Publish selected export files to a gallery',
    description:
      'Queues the files and returns at once; progress shows in the next scan. ' +
      'NEW files are uploaded, CHANGED (re-exported) ones replace their image ' +
      'in place, PUBLISHED ones are skipped. A new gallery is created as DRAFT.',
  })
  @ApiOkResponse({ type: PublishExportsResponse })
  publish(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: PublishExportsDto,
  ): Promise<PublishExportsResponse> {
    return this.exports.publish(userId, id, dto);
  }
}

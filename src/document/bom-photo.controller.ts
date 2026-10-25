import {
  Controller,
  Param,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { GetCurrentUser } from '../common/decorators';
import { BomService } from '../project/bom.service';
import { BomResponse } from '../project/responses';
import { uploadStorage } from './document.controller';
import { DocumentService } from './document.service';
import { DOCUMENT_MAX_BYTES } from './document-storage';
import { BomPhotoUploadDto } from './dto';

/**
 * A part's photo straight from the parts list, without going through the
 * library first. It lands as an image document pinned to the part.
 */
@ApiTags('Builds')
@ApiBearerAuth()
@Controller('bom')
export class BomPhotoController {
  constructor(
    private readonly documents: DocumentService,
    private readonly bom: BomService,
  ) {}

  @Post(':itemId/photo')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadStorage,
      limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: BomPhotoUploadDto })
  @ApiOperation({ summary: "Upload a part's photo" })
  @ApiOkResponse({ type: BomResponse })
  async upload(
    @GetCurrentUser('sub') userId: string,
    @Param('itemId') itemId: string,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<BomResponse> {
    await this.documents.uploadBomPhoto(userId, itemId, file);
    return this.bom.photoChanged(userId, itemId);
  }
}

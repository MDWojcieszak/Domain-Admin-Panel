import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Res,
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
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { randomUUID } from 'crypto';
import type { Response } from 'express';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';

import { GetCurrentUser, Public } from '../common/decorators';
import { DocumentService } from './document.service';
import { DOCUMENT_MAX_BYTES, DOCUMENT_TMP_DIR } from './document-storage';
import {
  CreateDocumentLinkDto,
  DocumentFileQueryDto,
  ListDocumentsQueryDto,
  UpdateDocumentDto,
  UploadDocumentDto,
} from './dto';
import { DocumentResponse, UploadDocumentResponse } from './responses';

/** Straight to disk: a 200 MB model never sits in memory. */
const uploadStorage = diskStorage({
  destination: (_req, _file, done) => {
    try {
      mkdirSync(DOCUMENT_TMP_DIR, { recursive: true });
      done(null, DOCUMENT_TMP_DIR);
    } catch (error) {
      done(error as Error, DOCUMENT_TMP_DIR);
    }
  },
  filename: (_req, _file, done) => done(null, `${randomUUID()}.upload`),
});

/**
 * The document library (docs/projects-design.md D8, D9). Like projects it is
 * personal data, so no ACL permission gates it: what you see is what you own
 * or what is pinned in a project you are in.
 */
@ApiTags('Documents')
@Controller('documents')
export class DocumentController {
  constructor(private readonly documents: DocumentService) {}

  @Get()
  @ApiBearerAuth()
  @ApiOkResponse({ type: DocumentResponse, isArray: true })
  list(
    @GetCurrentUser('sub') userId: string,
    @Query() query: ListDocumentsQueryDto,
  ): Promise<DocumentResponse[]> {
    return this.documents.list(userId, query);
  }

  @Post()
  @ApiBearerAuth()
  @UseInterceptors(
    FileInterceptor('file', {
      storage: uploadStorage,
      limits: { fileSize: DOCUMENT_MAX_BYTES, files: 1 },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadDocumentDto })
  @ApiOperation({
    summary: 'Upload any file to your library',
    description:
      'Optionally pinned to a project or task at once. The same file uploaded ' +
      'again returns the document you already have (duplicate: true).',
  })
  @ApiOkResponse({ type: UploadDocumentResponse })
  upload(
    @GetCurrentUser('sub') userId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadDocumentDto,
  ): Promise<UploadDocumentResponse> {
    return this.documents.upload(userId, file, dto);
  }

  @Get(':id')
  @ApiBearerAuth()
  @ApiOkResponse({ type: DocumentResponse })
  get(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<DocumentResponse> {
    return this.documents.get(userId, id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @ApiOkResponse({ type: DocumentResponse })
  update(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: UpdateDocumentDto,
  ): Promise<DocumentResponse> {
    return this.documents.update(userId, id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  remove(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
  ): Promise<void> {
    return this.documents.remove(userId, id);
  }

  @Post(':id/links')
  @ApiBearerAuth()
  @ApiOkResponse({ type: DocumentResponse })
  link(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreateDocumentLinkDto,
  ): Promise<DocumentResponse> {
    return this.documents.link(userId, id, dto);
  }

  /** Null when the pin was the only way you could see the document. */
  @Delete(':id/links/:linkId')
  @ApiBearerAuth()
  @ApiOkResponse({ type: DocumentResponse })
  unlink(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Param('linkId') linkId: string,
  ): Promise<DocumentResponse | null> {
    return this.documents.unlink(userId, id, linkId);
  }

  /**
   * Public, but only through a URL the API signed after checking access (D9).
   * Range requests work, so large PDFs and models stream.
   */
  @Public()
  @Get(':id/file')
  @ApiProduces('application/octet-stream')
  @ApiOperation({
    summary: 'A document file or preview (signed URL)',
    description:
      'Do not build this URL: take fileUrl / thumbUrl / previewUrl from the document.',
  })
  async file(
    @Param('id') id: string,
    @Query() query: DocumentFileQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const served = await this.documents.serve(id, query);
    res.setHeader('Content-Disposition', served.disposition);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // Anything the browser might render that we did not verify stays inert.
    if (served.disposition.startsWith('attachment')) {
      res.setHeader('Content-Security-Policy', "sandbox; default-src 'none'");
    } else if (served.contentType === 'application/pdf') {
      // The panel shows a PDF in a frame. A PDF has nothing to click into, and
      // the URL is signed, so the app-wide DENY is lifted for it alone.
      res.removeHeader('X-Frame-Options');
    }
    // As long as the signed URL stays the same (half an hour), and only for this browser.
    res.setHeader('Cache-Control', 'private, max-age=1800');
    res.sendFile(
      served.path,
      {
        headers: { 'Content-Type': served.contentType },
        cacheControl: false,
        dotfiles: 'allow',
      },
      (error) => {
        if (!error || res.headersSent) return;
        res.status(new NotFoundException().getStatus()).json({
          statusCode: 404,
          message: 'The file is missing on the server.',
        });
      },
    );
  }
}

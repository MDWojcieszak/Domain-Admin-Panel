import { Body, Controller, Param, Put, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { DocumentService } from './document.service';
import { SaveDocumentDto } from './dto';
import { SaveDocumentResponse } from './responses';

@ApiBearerAuth()
@ApiTags('Blog · Document')
@Controller('blog/posts')
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  /**
   * Upserts the whole post document: reconciles the draft's relational sections
   * against an ordered, provider-neutral block list in one transaction. Text is
   * written for `?locale`; structure/relations are language-neutral.
   */
  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Put(':postId/document')
  @ApiQuery({ name: 'locale', required: false })
  @ApiOkResponse({
    description: 'Refreshed draft + clientKey→sectionId map',
    type: SaveDocumentResponse,
  })
  save(
    @Param('postId') postId: string,
    @Body() dto: SaveDocumentDto,
    @Query('locale') locale?: string,
  ): Promise<SaveDocumentResponse> {
    return this.documentService.save(postId, locale, dto);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { PERMISSIONS } from '../../common/acl/permissions';
import { GetCurrentUser, RequirePermissions } from '../../common/decorators';
import {
  CreatePhotoEntryCommentDto,
  GetPhotoEntryCommentsQueryDto,
  PatchPhotoEntryCommentDto,
} from './dto';
import { PhotoEntryCommentService } from './photo-entry-comment.service';
import {
  PhotoEntryCommentListResponse,
  PhotoEntryCommentResponse,
} from './responses';

/** Comments pinned to the stage they were written at (§8). */
@ApiTags('Photo Entry')
@ApiBearerAuth()
@Controller('photo-entry')
export class PhotoEntryCommentController {
  constructor(private readonly comments: PhotoEntryCommentService) {}

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_READ)
  @Get(':id/comments')
  @ApiOperation({
    summary: 'Comments of an entry, grouped by stage',
    description:
      'Groups follow the entry history: planning, after the shoot, selecting, ' +
      'editing, finished. `unresolved=true` keeps only open TODOs.',
  })
  @ApiOkResponse({ type: PhotoEntryCommentListResponse })
  list(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Query() query: GetPhotoEntryCommentsQueryDto,
  ): Promise<PhotoEntryCommentListResponse> {
    return this.comments.list(userId, id, query);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Post(':id/comments')
  @ApiOperation({
    summary: 'Add a comment',
    description:
      'The stage is stamped from the entry as it is now and cannot be changed later.',
  })
  @ApiOkResponse({ type: PhotoEntryCommentResponse })
  create(
    @GetCurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() dto: CreatePhotoEntryCommentDto,
  ): Promise<PhotoEntryCommentResponse> {
    return this.comments.create(userId, id, dto);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Patch('comments/:commentId')
  @ApiOperation({
    summary: 'Edit body or kind',
    description: 'Turning a TODO into another kind drops its resolution.',
  })
  @ApiOkResponse({ type: PhotoEntryCommentResponse })
  patch(
    @GetCurrentUser('sub') userId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
    @Body() dto: PatchPhotoEntryCommentDto,
  ): Promise<PhotoEntryCommentResponse> {
    return this.comments.patch(userId, commentId, dto);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Post('comments/:commentId/resolve')
  @ApiOperation({ summary: 'Tick a TODO off (TODO comments only)' })
  @ApiOkResponse({ type: PhotoEntryCommentResponse })
  resolve(
    @GetCurrentUser('sub') userId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<PhotoEntryCommentResponse> {
    return this.comments.resolve(userId, commentId);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Post('comments/:commentId/reopen')
  @ApiOperation({ summary: 'Undo a resolve' })
  @ApiOkResponse({ type: PhotoEntryCommentResponse })
  reopen(
    @GetCurrentUser('sub') userId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<PhotoEntryCommentResponse> {
    return this.comments.reopen(userId, commentId);
  }

  @RequirePermissions(PERMISSIONS.PHOTO_ENTRY_MANAGE)
  @Delete('comments/:commentId')
  @ApiOkResponse({ description: 'Deleted comment' })
  remove(
    @GetCurrentUser('sub') userId: string,
    @Param('commentId', ParseUUIDPipe) commentId: string,
  ): Promise<{ id: string }> {
    return this.comments.remove(userId, commentId);
  }
}

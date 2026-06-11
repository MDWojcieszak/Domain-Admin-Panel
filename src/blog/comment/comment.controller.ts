import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Role } from '@prisma/client';

import { GetCurrentUser, RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { toBoolean } from '../../common/helpers/cast.helper';
import { CommentService } from './comment.service';
import { CreateCommentDto, PatchCommentDto } from './dto';
import { CommentListResponse, EditorialCommentResponse } from './responses';

@Controller('blog/posts')
@ApiTags('Blog · Editorial comments')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.BLOG_WRITE)
export class CommentController {
  constructor(private readonly commentService: CommentService) {}

  @Post(':postId/comments')
  @ApiOkResponse({
    description: 'Created comment',
    type: EditorialCommentResponse,
  })
  async create(
    @Param('postId') postId: string,
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreateCommentDto,
  ): Promise<EditorialCommentResponse> {
    return this.commentService.create(postId, userId, dto);
  }

  @Get(':postId/comments')
  @ApiQuery({
    name: 'sectionId',
    required: false,
    description: 'Filter to one section thread; omit for the whole post.',
  })
  @ApiQuery({
    name: 'global',
    required: false,
    type: Boolean,
    description:
      'true → only post-level (global) comments. Ignored if sectionId is set.',
  })
  @ApiOkResponse({ description: 'List comments', type: CommentListResponse })
  async list(
    @Param('postId') postId: string,
    @Query('sectionId') sectionId?: string,
    @Query('global') global?: string,
  ): Promise<CommentListResponse> {
    return this.commentService.list(postId, {
      sectionId,
      global: toBoolean(global),
    });
  }

  @Get(':postId/comments/:commentId')
  @ApiOkResponse({
    description: 'Comment detail',
    type: EditorialCommentResponse,
  })
  async get(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
  ): Promise<EditorialCommentResponse> {
    return this.commentService.get(postId, commentId);
  }

  @Patch(':postId/comments/:commentId')
  @ApiOkResponse({
    description: 'Patched comment',
    type: EditorialCommentResponse,
  })
  async patch(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('role') role: Role,
    @Body() dto: PatchCommentDto,
  ): Promise<EditorialCommentResponse> {
    return this.commentService.patch(postId, commentId, userId, role, dto);
  }

  @Delete(':postId/comments/:commentId')
  @ApiOkResponse({
    description: 'Deleted comment',
    type: EditorialCommentResponse,
  })
  async delete(
    @Param('postId') postId: string,
    @Param('commentId') commentId: string,
    @GetCurrentUser('sub') userId: string,
    @GetCurrentUser('role') role: Role,
  ): Promise<EditorialCommentResponse> {
    return this.commentService.delete(postId, commentId, userId, role);
  }
}

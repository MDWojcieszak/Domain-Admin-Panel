import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetCurrentUser, RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { PostService } from './post.service';
import {
  CreatePostDto,
  GetPostsQueryDto,
  PatchPostDto,
  ReorderPostsDto,
  SetPostAuthorsDto,
  UpsertPostTranslationDto,
} from './dto';
import { PostDraftResponse, PostListResponse, PostResponse } from './responses';

@Controller('blog/posts')
@ApiTags('Blog · Posts')
@ApiBearerAuth()
export class PostController {
  constructor(private readonly postService: PostService) {}

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Get()
  @ApiOkResponse({ description: 'List posts', type: PostListResponse })
  async list(@Query() query: GetPostsQueryDto): Promise<PostListResponse> {
    return this.postService.list(query);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Patch('reorder')
  @ApiOkResponse({ description: 'Reordered posts', type: PostListResponse })
  async reorder(@Body() dto: ReorderPostsDto): Promise<PostListResponse> {
    return this.postService.reorder(dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ)
  @Get(':id')
  @ApiOkResponse({ description: 'Post summary', type: PostResponse })
  async getById(@Param('id') id: string): Promise<PostResponse> {
    return this.postService.getById(id);
  }

  @RequirePermissions(PERMISSIONS.BLOG_READ_DRAFT)
  @Get(':id/draft')
  @ApiOkResponse({
    description: 'Full draft version resolved to a locale (staff preview)',
    type: PostDraftResponse,
  })
  async getDraft(
    @Param('id') id: string,
    @Query('locale') locale?: string,
  ): Promise<PostDraftResponse> {
    return this.postService.getDraft(id, locale);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Post()
  @ApiOkResponse({ description: 'Created post', type: PostResponse })
  async create(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreatePostDto,
  ): Promise<PostResponse> {
    return this.postService.create(userId, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Patch(':id')
  @ApiOkResponse({ description: 'Patched post', type: PostResponse })
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchPostDto,
  ): Promise<PostResponse> {
    return this.postService.patch(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Put(':id/translations/:locale')
  @ApiOkResponse({
    description: 'Upserted draft version translation',
    type: PostResponse,
  })
  async upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertPostTranslationDto,
  ): Promise<PostResponse> {
    return this.postService.upsertTranslation(id, locale, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Put(':id/authors')
  @ApiOkResponse({ description: 'Set post byline', type: PostResponse })
  async setAuthors(
    @Param('id') id: string,
    @Body() dto: SetPostAuthorsDto,
  ): Promise<PostResponse> {
    return this.postService.setAuthors(id, dto);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { HomeService } from './home.service';
import {
  AddHomeBlockPostDto,
  CreateHomeBlockDto,
  CreateHomeLayoutDto,
  GetHomeLayoutsQueryDto,
  PatchHomeBlockDto,
  PatchHomeLayoutDto,
  ReorderHomeBlockPostsDto,
  ReorderHomeBlocksDto,
  SetHomeBlockPostsDto,
  UpsertHomeBlockTranslationDto,
} from './dto';
import {
  HomeBlockResponse,
  HomeLayoutListResponse,
  HomeLayoutResponse,
} from './responses';

@Controller('blog/home/layouts')
@ApiTags('Blog · Home (admin)')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.BLOG_HOME_MANAGE)
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  // ----- layouts -----

  @Get()
  @ApiOkResponse({ description: 'List layouts', type: HomeLayoutListResponse })
  async list(
    @Query() query: GetHomeLayoutsQueryDto,
  ): Promise<HomeLayoutListResponse> {
    return this.homeService.listLayouts(query);
  }

  @Post()
  @ApiOkResponse({ description: 'Created layout', type: HomeLayoutResponse })
  async create(@Body() dto: CreateHomeLayoutDto): Promise<HomeLayoutResponse> {
    return this.homeService.createLayout(dto);
  }

  @Get(':layoutId')
  @ApiOkResponse({ description: 'Layout detail', type: HomeLayoutResponse })
  async get(@Param('layoutId') layoutId: string): Promise<HomeLayoutResponse> {
    return this.homeService.getLayout(layoutId);
  }

  @Patch(':layoutId')
  @ApiOkResponse({ description: 'Patched layout', type: HomeLayoutResponse })
  async patch(
    @Param('layoutId') layoutId: string,
    @Body() dto: PatchHomeLayoutDto,
  ): Promise<HomeLayoutResponse> {
    return this.homeService.patchLayout(layoutId, dto);
  }

  @Post(':layoutId/activate')
  @ApiOkResponse({ description: 'Activated layout', type: HomeLayoutResponse })
  async activate(
    @Param('layoutId') layoutId: string,
  ): Promise<HomeLayoutResponse> {
    return this.homeService.activateLayout(layoutId);
  }

  @Delete(':layoutId')
  @ApiOkResponse({ description: 'Deleted layout', type: HomeLayoutResponse })
  async delete(
    @Param('layoutId') layoutId: string,
  ): Promise<HomeLayoutResponse> {
    return this.homeService.deleteLayout(layoutId);
  }

  // ----- blocks -----

  @Post(':layoutId/blocks')
  @ApiOkResponse({ description: 'Created block', type: HomeBlockResponse })
  async createBlock(
    @Param('layoutId') layoutId: string,
    @Body() dto: CreateHomeBlockDto,
  ): Promise<HomeBlockResponse> {
    return this.homeService.createBlock(layoutId, dto);
  }

  @Patch(':layoutId/blocks/reorder')
  @ApiOkResponse({ description: 'Reordered blocks', type: HomeLayoutResponse })
  async reorderBlocks(
    @Param('layoutId') layoutId: string,
    @Body() dto: ReorderHomeBlocksDto,
  ): Promise<HomeLayoutResponse> {
    return this.homeService.reorderBlocks(layoutId, dto);
  }

  @Patch(':layoutId/blocks/:blockId/posts/reorder')
  @ApiOkResponse({
    description: 'Reordered curated posts',
    type: HomeBlockResponse,
  })
  async reorderBlockPosts(
    @Param('layoutId') layoutId: string,
    @Param('blockId') blockId: string,
    @Body() dto: ReorderHomeBlockPostsDto,
  ): Promise<HomeBlockResponse> {
    return this.homeService.reorderBlockPosts(layoutId, blockId, dto);
  }

  @Patch(':layoutId/blocks/:blockId')
  @ApiOkResponse({ description: 'Patched block', type: HomeBlockResponse })
  async patchBlock(
    @Param('layoutId') layoutId: string,
    @Param('blockId') blockId: string,
    @Body() dto: PatchHomeBlockDto,
  ): Promise<HomeBlockResponse> {
    return this.homeService.patchBlock(layoutId, blockId, dto);
  }

  @Delete(':layoutId/blocks/:blockId')
  @ApiOkResponse({ description: 'Deleted block', type: HomeBlockResponse })
  async deleteBlock(
    @Param('layoutId') layoutId: string,
    @Param('blockId') blockId: string,
  ): Promise<HomeBlockResponse> {
    return this.homeService.deleteBlock(layoutId, blockId);
  }

  @Put(':layoutId/blocks/:blockId/translations/:locale')
  @ApiOkResponse({
    description: 'Upserted block translation',
    type: HomeBlockResponse,
  })
  async upsertBlockTranslation(
    @Param('layoutId') layoutId: string,
    @Param('blockId') blockId: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertHomeBlockTranslationDto,
  ): Promise<HomeBlockResponse> {
    return this.homeService.upsertBlockTranslation(
      layoutId,
      blockId,
      locale,
      dto,
    );
  }

  // ----- curated posts -----

  @Put(':layoutId/blocks/:blockId/posts')
  @ApiOkResponse({
    description: 'Replaced curated posts',
    type: HomeBlockResponse,
  })
  async setBlockPosts(
    @Param('layoutId') layoutId: string,
    @Param('blockId') blockId: string,
    @Body() dto: SetHomeBlockPostsDto,
  ): Promise<HomeBlockResponse> {
    return this.homeService.setBlockPosts(layoutId, blockId, dto);
  }

  @Post(':layoutId/blocks/:blockId/posts')
  @ApiOkResponse({ description: 'Added curated post', type: HomeBlockResponse })
  async addBlockPost(
    @Param('layoutId') layoutId: string,
    @Param('blockId') blockId: string,
    @Body() dto: AddHomeBlockPostDto,
  ): Promise<HomeBlockResponse> {
    return this.homeService.addBlockPost(layoutId, blockId, dto);
  }

  @Delete(':layoutId/blocks/:blockId/posts/:postId')
  @ApiOkResponse({
    description: 'Removed curated post',
    type: HomeBlockResponse,
  })
  async removeBlockPost(
    @Param('layoutId') layoutId: string,
    @Param('blockId') blockId: string,
    @Param('postId') postId: string,
  ): Promise<HomeBlockResponse> {
    return this.homeService.removeBlockPost(layoutId, blockId, postId);
  }
}

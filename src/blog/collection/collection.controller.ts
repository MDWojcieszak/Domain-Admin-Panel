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

import { Public, RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { CollectionService } from './collection.service';
import {
  AddCollectionItemDto,
  CreateCollectionDto,
  GetCollectionsQueryDto,
  PatchCollectionDto,
  PatchCollectionItemDto,
  ReorderCollectionItemsDto,
  UpsertCollectionTranslationDto,
} from './dto';
import {
  CollectionListResponse,
  CollectionResponse,
  PublicCollectionResponse,
} from './responses';

@Controller('blog/collections')
@ApiTags('Blog · Collections')
export class CollectionController {
  constructor(private readonly collectionService: CollectionService) {}

  // --- public (no auth) ---

  @Public()
  @Get('by-slug/:slug')
  @ApiOkResponse({
    description: 'Public ranked collection',
    type: PublicCollectionResponse,
  })
  async getPublic(
    @Param('slug') slug: string,
    @Query('locale') locale?: string,
  ): Promise<PublicCollectionResponse> {
    return this.collectionService.getPublicBySlug(slug, locale);
  }

  // --- admin ---

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Get()
  @ApiOkResponse({
    description: 'Admin collection list',
    type: CollectionListResponse,
  })
  async list(
    @Query() query: GetCollectionsQueryDto,
  ): Promise<CollectionListResponse> {
    return this.collectionService.list(query);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Get(':id')
  @ApiOkResponse({
    description: 'Admin collection detail',
    type: CollectionResponse,
  })
  async getById(@Param('id') id: string): Promise<CollectionResponse> {
    return this.collectionService.getById(id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Post()
  @ApiOkResponse({
    description: 'Created collection',
    type: CollectionResponse,
  })
  async create(@Body() dto: CreateCollectionDto): Promise<CollectionResponse> {
    return this.collectionService.create(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Post(':id/items')
  @ApiOkResponse({
    description: 'Added collection item',
    type: CollectionResponse,
  })
  async addItem(
    @Param('id') id: string,
    @Body() dto: AddCollectionItemDto,
  ): Promise<CollectionResponse> {
    return this.collectionService.addItem(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Patch(':id/items/reorder')
  @ApiOkResponse({
    description: 'Reordered collection items',
    type: CollectionResponse,
  })
  async reorderItems(
    @Param('id') id: string,
    @Body() dto: ReorderCollectionItemsDto,
  ): Promise<CollectionResponse> {
    return this.collectionService.reorderItems(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Patch(':id/items/:itemId')
  @ApiOkResponse({
    description: 'Patched collection item',
    type: CollectionResponse,
  })
  async patchItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
    @Body() dto: PatchCollectionItemDto,
  ): Promise<CollectionResponse> {
    return this.collectionService.patchItem(id, itemId, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Patch(':id')
  @ApiOkResponse({
    description: 'Patched collection',
    type: CollectionResponse,
  })
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchCollectionDto,
  ): Promise<CollectionResponse> {
    return this.collectionService.patch(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Put(':id/translations/:locale')
  @ApiOkResponse({
    description: 'Upserted collection translation',
    type: CollectionResponse,
  })
  async upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertCollectionTranslationDto,
  ): Promise<CollectionResponse> {
    return this.collectionService.upsertTranslation(id, locale, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Delete(':id/items/:itemId')
  @ApiOkResponse({
    description: 'Removed collection item',
    type: CollectionResponse,
  })
  async deleteItem(
    @Param('id') id: string,
    @Param('itemId') itemId: string,
  ): Promise<CollectionResponse> {
    return this.collectionService.deleteItem(id, itemId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Delete(':id')
  @ApiOkResponse({
    description: 'Deleted collection',
    type: CollectionResponse,
  })
  async delete(@Param('id') id: string): Promise<CollectionResponse> {
    return this.collectionService.delete(id);
  }
}

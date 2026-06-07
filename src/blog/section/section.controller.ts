import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { SectionService } from './section.service';
import {
  AddSectionImageDto,
  AddSectionListItemDto,
  CreateSectionDto,
  PatchSectionDto,
  PatchSectionImageDto,
  PatchSectionListItemDto,
  ReorderDto,
  UpsertSectionImageTranslationDto,
  UpsertSectionListItemTranslationDto,
  UpsertSectionTranslationDto,
} from './dto';
import { SectionListResponse, SectionResponse } from './responses';

@Controller('blog')
@ApiTags('Blog · Sections')
@ApiBearerAuth()
export class SectionController {
  constructor(private readonly sectionService: SectionService) {}

  // ----- sections under a post's draft version -----

  @RequirePermissions(PERMISSIONS.BLOG_READ_DRAFT)
  @Get('posts/:postId/sections')
  @ApiOkResponse({
    description: 'List draft sections',
    type: SectionListResponse,
  })
  async list(@Param('postId') postId: string): Promise<SectionListResponse> {
    return this.sectionService.listForPost(postId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Post('posts/:postId/sections')
  @ApiOkResponse({ description: 'Created section', type: SectionResponse })
  async create(
    @Param('postId') postId: string,
    @Body() dto: CreateSectionDto,
  ): Promise<SectionResponse> {
    return this.sectionService.createForPost(postId, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Patch('posts/:postId/sections/reorder')
  @ApiOkResponse({
    description: 'Reordered sections',
    type: SectionListResponse,
  })
  async reorder(
    @Param('postId') postId: string,
    @Body() dto: ReorderDto,
  ): Promise<SectionListResponse> {
    return this.sectionService.reorderForPost(postId, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Patch('sections/:id')
  @ApiOkResponse({ description: 'Patched section', type: SectionResponse })
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchSectionDto,
  ): Promise<SectionResponse> {
    return this.sectionService.patch(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Delete('sections/:id')
  @ApiOkResponse({ description: 'Deleted section', type: SectionResponse })
  async delete(@Param('id') id: string): Promise<SectionResponse> {
    return this.sectionService.delete(id);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Put('sections/:id/translations/:locale')
  @ApiOkResponse({
    description: 'Upserted section translation',
    type: SectionResponse,
  })
  async upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertSectionTranslationDto,
  ): Promise<SectionResponse> {
    return this.sectionService.upsertTranslation(id, locale, dto);
  }

  // ----- section images -----

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Post('sections/:id/images')
  @ApiOkResponse({ description: 'Added section image', type: SectionResponse })
  async addImage(
    @Param('id') id: string,
    @Body() dto: AddSectionImageDto,
  ): Promise<SectionResponse> {
    return this.sectionService.addImage(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Patch('sections/:id/images/reorder')
  @ApiOkResponse({
    description: 'Reordered section images',
    type: SectionResponse,
  })
  async reorderImages(
    @Param('id') id: string,
    @Body() dto: ReorderDto,
  ): Promise<SectionResponse> {
    return this.sectionService.reorderImages(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Patch('section-images/:imageId')
  @ApiOkResponse({
    description: 'Patched section image',
    type: SectionResponse,
  })
  async patchImage(
    @Param('imageId') imageId: string,
    @Body() dto: PatchSectionImageDto,
  ): Promise<SectionResponse> {
    return this.sectionService.patchImage(imageId, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Delete('section-images/:imageId')
  @ApiOkResponse({
    description: 'Deleted section image',
    type: SectionResponse,
  })
  async deleteImage(
    @Param('imageId') imageId: string,
  ): Promise<SectionResponse> {
    return this.sectionService.deleteImage(imageId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Put('section-images/:imageId/translations/:locale')
  @ApiOkResponse({
    description: 'Upserted section image translation',
    type: SectionResponse,
  })
  async upsertImageTranslation(
    @Param('imageId') imageId: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertSectionImageTranslationDto,
  ): Promise<SectionResponse> {
    return this.sectionService.upsertImageTranslation(imageId, locale, dto);
  }

  // ----- section list items -----

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Post('sections/:id/items')
  @ApiOkResponse({ description: 'Added list item', type: SectionResponse })
  async addItem(
    @Param('id') id: string,
    @Body() dto: AddSectionListItemDto,
  ): Promise<SectionResponse> {
    return this.sectionService.addItem(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Patch('sections/:id/items/reorder')
  @ApiOkResponse({ description: 'Reordered list items', type: SectionResponse })
  async reorderItems(
    @Param('id') id: string,
    @Body() dto: ReorderDto,
  ): Promise<SectionResponse> {
    return this.sectionService.reorderItems(id, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Patch('section-items/:itemId')
  @ApiOkResponse({ description: 'Patched list item', type: SectionResponse })
  async patchItem(
    @Param('itemId') itemId: string,
    @Body() dto: PatchSectionListItemDto,
  ): Promise<SectionResponse> {
    return this.sectionService.patchItem(itemId, dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Delete('section-items/:itemId')
  @ApiOkResponse({ description: 'Deleted list item', type: SectionResponse })
  async deleteItem(@Param('itemId') itemId: string): Promise<SectionResponse> {
    return this.sectionService.deleteItem(itemId);
  }

  @RequirePermissions(PERMISSIONS.BLOG_WRITE)
  @Put('section-items/:itemId/translations/:locale')
  @ApiOkResponse({
    description: 'Upserted list item translation',
    type: SectionResponse,
  })
  async upsertItemTranslation(
    @Param('itemId') itemId: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertSectionListItemTranslationDto,
  ): Promise<SectionResponse> {
    return this.sectionService.upsertItemTranslation(itemId, locale, dto);
  }
}

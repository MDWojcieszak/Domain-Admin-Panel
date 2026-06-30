import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetCurrentUser, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { GalleriesService } from './galleries.service';
import {
  CreateGalleryDto,
  PatchGalleryStatusDto,
  SetGalleryItemsDto,
  UpdateGalleryDto,
} from './dto';
import {
  GalleryDetailResponse,
  GalleryListResponse,
  GalleryResponse,
} from './responses';

@ApiTags('Galleries')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.GALLERY_MANAGE)
@Controller('galleries')
export class GalleriesController {
  constructor(private readonly galleries: GalleriesService) {}

  @Post()
  @ApiOkResponse({
    description: 'Create a gallery (DRAFT)',
    type: GalleryResponse,
  })
  create(
    @GetCurrentUser('sub') userId: string,
    @Body() dto: CreateGalleryDto,
  ): Promise<GalleryResponse> {
    return this.galleries.create(userId, dto);
  }

  @Get()
  @ApiOkResponse({
    description: 'List all galleries',
    type: GalleryListResponse,
  })
  list(): Promise<GalleryListResponse> {
    return this.galleries.list();
  }

  @Post('import-existing')
  @ApiOkResponse({
    description: 'Collect ungrouped gallery images into a DRAFT import gallery',
    type: GalleryDetailResponse,
  })
  importExisting(
    @GetCurrentUser('sub') userId: string,
  ): Promise<GalleryDetailResponse> {
    return this.galleries.importExisting(userId);
  }

  @Get(':id')
  @ApiOkResponse({
    description: 'Gallery with ordered items (admin preview)',
    type: GalleryDetailResponse,
  })
  getById(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GalleryDetailResponse> {
    return this.galleries.getById(id);
  }

  @Patch(':id')
  @ApiOkResponse({ description: 'Update gallery', type: GalleryResponse })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGalleryDto,
  ): Promise<GalleryResponse> {
    return this.galleries.update(id, dto);
  }

  @Patch(':id/status')
  @ApiOkResponse({
    description: 'Change gallery status',
    type: GalleryResponse,
  })
  patchStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PatchGalleryStatusDto,
  ): Promise<GalleryResponse> {
    return this.galleries.patchStatus(id, dto);
  }

  @Put(':id/items')
  @ApiOkResponse({
    description: 'Replace the ordered image set (drag & drop + roles)',
    type: GalleryDetailResponse,
  })
  setItems(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetGalleryItemsDto,
  ): Promise<GalleryDetailResponse> {
    return this.galleries.setItems(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Delete gallery (images are kept)' })
  delete(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.galleries.delete(id);
  }
}

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
import { PoiService } from './poi.service';
import {
  AddPoiImageDto,
  CreatePoiDto,
  GetPoiAdminQueryDto,
  GetPoiMapQueryDto,
  PatchPoiDto,
  PatchPoiImageDto,
  ReorderDto,
  SetPoiCategoriesDto,
  SetPoiHoursDto,
  UpsertPoiTranslationDto,
} from './dto';
import {
  PoiAdminListResponse,
  PoiAdminResponse,
  PoiPublicListResponse,
} from './responses';

@Controller('blog/poi')
@ApiTags('Blog · POI')
export class PoiController {
  constructor(private readonly poiService: PoiService) {}

  // --- public map (no auth) ---

  @Public()
  @Get()
  @ApiOkResponse({
    description: 'Public POI map list',
    type: PoiPublicListResponse,
  })
  async listPublic(
    @Query() query: GetPoiMapQueryDto,
  ): Promise<PoiPublicListResponse> {
    return this.poiService.listPublic(query);
  }

  // --- admin (declare static segments before :id) ---

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Get('admin')
  @ApiOkResponse({ description: 'Admin POI list', type: PoiAdminListResponse })
  async listAdmin(
    @Query() query: GetPoiAdminQueryDto,
  ): Promise<PoiAdminListResponse> {
    return this.poiService.listAdmin(query);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Get(':id')
  @ApiOkResponse({ description: 'Admin POI detail', type: PoiAdminResponse })
  async getAdmin(@Param('id') id: string): Promise<PoiAdminResponse> {
    return this.poiService.getAdmin(id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Post()
  @ApiOkResponse({ description: 'Created POI', type: PoiAdminResponse })
  async create(@Body() dto: CreatePoiDto): Promise<PoiAdminResponse> {
    return this.poiService.create(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Post(':id/images')
  @ApiOkResponse({ description: 'Added POI image', type: PoiAdminResponse })
  async addImage(
    @Param('id') id: string,
    @Body() dto: AddPoiImageDto,
  ): Promise<PoiAdminResponse> {
    return this.poiService.addImage(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Patch('images/:imageId')
  @ApiOkResponse({ description: 'Patched POI image', type: PoiAdminResponse })
  async patchImage(
    @Param('imageId') imageId: string,
    @Body() dto: PatchPoiImageDto,
  ): Promise<PoiAdminResponse> {
    return this.poiService.patchImage(imageId, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Patch(':id/images/reorder')
  @ApiOkResponse({
    description: 'Reordered POI images',
    type: PoiAdminResponse,
  })
  async reorderImages(
    @Param('id') id: string,
    @Body() dto: ReorderDto,
  ): Promise<PoiAdminResponse> {
    return this.poiService.reorderImages(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Patch(':id')
  @ApiOkResponse({ description: 'Patched POI', type: PoiAdminResponse })
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchPoiDto,
  ): Promise<PoiAdminResponse> {
    return this.poiService.patch(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Put(':id/translations/:locale')
  @ApiOkResponse({
    description: 'Upserted POI translation',
    type: PoiAdminResponse,
  })
  async upsertTranslation(
    @Param('id') id: string,
    @Param('locale') locale: string,
    @Body() dto: UpsertPoiTranslationDto,
  ): Promise<PoiAdminResponse> {
    return this.poiService.upsertTranslation(id, locale, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Put(':id/hours')
  @ApiOkResponse({ description: 'Replaced POI hours', type: PoiAdminResponse })
  async setHours(
    @Param('id') id: string,
    @Body() dto: SetPoiHoursDto,
  ): Promise<PoiAdminResponse> {
    return this.poiService.setHours(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Put(':id/categories')
  @ApiOkResponse({
    description: 'Replaced POI categories',
    type: PoiAdminResponse,
  })
  async setCategories(
    @Param('id') id: string,
    @Body() dto: SetPoiCategoriesDto,
  ): Promise<PoiAdminResponse> {
    return this.poiService.setCategories(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Delete('images/:imageId')
  @ApiOkResponse({ description: 'Deleted POI image', type: PoiAdminResponse })
  async deleteImage(
    @Param('imageId') imageId: string,
  ): Promise<PoiAdminResponse> {
    return this.poiService.deleteImage(imageId);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.BLOG_PLACE_MANAGE)
  @Delete(':id')
  @ApiOkResponse({ description: 'Deleted POI', type: PoiAdminResponse })
  async delete(@Param('id') id: string): Promise<PoiAdminResponse> {
    return this.poiService.delete(id);
  }
}

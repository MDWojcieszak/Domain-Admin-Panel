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
  Query,
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
  ApiTags,
} from '@nestjs/swagger';
import { ImageScope } from '@prisma/client';
import { Express } from 'express';

import { PERMISSIONS } from '../common/acl/permissions';
import { GetCurrentUser, RequirePermissions } from '../common/decorators';
import { ImageValidationPipe } from '../common/pipes/image-validation.pipe';
import { FileDto } from '../file/dto';
import { FileService } from '../file/file.service';
import { UploadResponseDto } from '../file/responses';
import {
  CreateGearDto,
  CreateGearKitDto,
  CreateGearSystemDto,
  GetGearImagesQueryDto,
  GetGearItemsQueryDto,
  ReorderGearDto,
  UpdateGearDto,
  UpdateGearKitDto,
  UpdateGearSystemDto,
} from './dto';
import { GearService } from './gear.service';
import {
  GearCategoryResponse,
  GearImageListResponse,
  GearItemAdminResponse,
  GearItemListResponse,
  GearKitResponse,
  GearOverviewResponse,
  GearSystemResponse,
} from './responses';

@ApiTags('Gear')
@ApiBearerAuth()
@RequirePermissions(PERMISSIONS.GALLERY_MANAGE)
@Controller('gear')
export class GearController {
  constructor(
    private readonly gear: GearService,
    private readonly files: FileService,
  ) {}

  @Get()
  @ApiOkResponse({
    description: 'All gear (systems + items), including hidden',
    type: GearOverviewResponse,
  })
  list(): Promise<GearOverviewResponse> {
    return this.gear.listAll();
  }

  @Get('images')
  @ApiOperation({
    summary: 'Gear photos to pick from',
    description:
      'Reuse one photo for identical items. `usedBy` shows which gear already ' +
      'shows it; `search` matches that gear by brand/model; `unusedOnly` lists ' +
      'uploads not attached yet. Gallery photos appear only if gear uses them.',
  })
  @ApiOkResponse({ type: GearImageListResponse })
  listImages(
    @Query() query: GetGearImagesQueryDto,
  ): Promise<GearImageListResponse> {
    return this.gear.listImages(query);
  }

  @Post('images')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: FileDto })
  @ApiOperation({
    summary: 'Upload a gear photo',
    description:
      'Stored with scope GEAR, so it never appears in the gallery or among ' +
      'unassigned gallery photos. Pass the returned id as imageId on a gear ' +
      'item or system.',
  })
  @ApiOkResponse({
    description: 'Uploaded a GEAR-scoped image',
    type: UploadResponseDto,
  })
  uploadImage(
    @GetCurrentUser('sub') userId: string,
    @UploadedFile(new ImageValidationPipe()) file: Express.Multer.File,
  ): Promise<UploadResponseDto> {
    return this.files.uploadImage(file, ImageScope.GEAR, userId);
  }

  @Get('items')
  @ApiOkResponse({
    description:
      'Flat gear list with neededBy. ownership=WISHLIST&sort=NEEDED_BY is the shopping plan; ' +
      'ownership=OWNED&sort=NEEDED_BY is what is needed soon. neededWithinDays narrows to a horizon.',
    type: GearItemListResponse,
  })
  listItems(
    @Query() query: GetGearItemsQueryDto,
  ): Promise<GearItemListResponse> {
    return this.gear.listItems(query);
  }

  @Get('categories')
  @ApiOkResponse({
    description: 'Gear categories with their media source',
    type: GearCategoryResponse,
    isArray: true,
  })
  listCategories(): GearCategoryResponse[] {
    return this.gear.listCategories();
  }

  // -------- Kits (declared before :id item routes) --------

  @Get('kits')
  @ApiOkResponse({
    description: 'Gear kits',
    type: GearKitResponse,
    isArray: true,
  })
  listKits(): Promise<GearKitResponse[]> {
    return this.gear.listKits();
  }

  @Get('kits/:id')
  @ApiOkResponse({ description: 'Gear kit', type: GearKitResponse })
  getKit(@Param('id', ParseUUIDPipe) id: string): Promise<GearKitResponse> {
    return this.gear.getKit(id);
  }

  @Post('kits')
  @ApiOkResponse({ description: 'Create a gear kit', type: GearKitResponse })
  createKit(@Body() dto: CreateGearKitDto): Promise<GearKitResponse> {
    return this.gear.createKit(dto);
  }

  @Patch('kits/:id')
  @ApiOkResponse({ description: 'Update a gear kit', type: GearKitResponse })
  updateKit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGearKitDto,
  ): Promise<GearKitResponse> {
    return this.gear.updateKit(id, dto);
  }

  @Delete('kits/:id')
  @ApiOkResponse({
    description: 'Delete a gear kit (entries keep their copied rows)',
  })
  removeKit(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.gear.removeKit(id);
  }

  // -------- Systems (declared before :id item routes) --------

  @Post('systems')
  @ApiOkResponse({
    description: 'Create a camera system',
    type: GearSystemResponse,
  })
  createSystem(@Body() dto: CreateGearSystemDto): Promise<GearSystemResponse> {
    return this.gear.createSystem(dto);
  }

  @Put('systems/order')
  @ApiOkResponse({ description: 'Reorder systems', type: GearOverviewResponse })
  reorderSystems(@Body() dto: ReorderGearDto): Promise<GearOverviewResponse> {
    return this.gear.reorderSystems(dto.ids);
  }

  @Patch('systems/:id')
  @ApiOkResponse({
    description: 'Update a camera system',
    type: GearSystemResponse,
  })
  updateSystem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGearSystemDto,
  ): Promise<GearSystemResponse> {
    return this.gear.updateSystem(id, dto);
  }

  @Delete('systems/:id')
  @ApiOkResponse({ description: 'Delete a system (its items are kept)' })
  removeSystem(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ id: string }> {
    return this.gear.removeSystem(id);
  }

  // -------- Items --------

  @Post()
  @ApiOkResponse({
    description: 'Create a gear item',
    type: GearItemAdminResponse,
  })
  create(@Body() dto: CreateGearDto): Promise<GearItemAdminResponse> {
    return this.gear.create(dto);
  }

  @Put('order')
  @ApiOkResponse({
    description: 'Reorder gear items',
    type: GearOverviewResponse,
  })
  reorder(@Body() dto: ReorderGearDto): Promise<GearOverviewResponse> {
    return this.gear.reorderItems(dto.ids);
  }

  @Get(':id')
  @ApiOkResponse({ description: 'Gear item', type: GearItemAdminResponse })
  getItem(
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<GearItemAdminResponse> {
    return this.gear.getItem(id);
  }

  @Patch(':id')
  @ApiOkResponse({
    description: 'Update a gear item',
    type: GearItemAdminResponse,
  })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGearDto,
  ): Promise<GearItemAdminResponse> {
    return this.gear.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({
    description:
      'Delete a gear item. Refused (409) once any entry records it as used or secured — retire it instead (P12)',
  })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.gear.remove(id);
  }
}

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
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { PERMISSIONS } from '../common/acl/permissions';
import { RequirePermissions } from '../common/decorators';
import {
  CreateGearDto,
  CreateGearKitDto,
  CreateGearSystemDto,
  GetGearItemsQueryDto,
  ReorderGearDto,
  UpdateGearDto,
  UpdateGearKitDto,
  UpdateGearSystemDto,
} from './dto';
import { GearService } from './gear.service';
import {
  GearCategoryResponse,
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
  constructor(private readonly gear: GearService) {}

  @Get()
  @ApiOkResponse({
    description: 'All gear (systems + items), including hidden',
    type: GearOverviewResponse,
  })
  list(): Promise<GearOverviewResponse> {
    return this.gear.listAll();
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

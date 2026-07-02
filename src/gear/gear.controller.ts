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

import { PERMISSIONS } from '../common/acl/permissions';
import { RequirePermissions } from '../common/decorators';
import {
  CreateGearDto,
  CreateGearSystemDto,
  ReorderGearDto,
  UpdateGearDto,
  UpdateGearSystemDto,
} from './dto';
import { GearService } from './gear.service';
import {
  GearItemResponse,
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
  @ApiOkResponse({ description: 'Create a gear item', type: GearItemResponse })
  create(@Body() dto: CreateGearDto): Promise<GearItemResponse> {
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

  @Patch(':id')
  @ApiOkResponse({ description: 'Update a gear item', type: GearItemResponse })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGearDto,
  ): Promise<GearItemResponse> {
    return this.gear.update(id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ description: 'Delete a gear item' })
  remove(@Param('id', ParseUUIDPipe) id: string): Promise<{ id: string }> {
    return this.gear.remove(id);
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { AstroObjectService } from './astro-object.service';
import {
  CreateAstroObjectDto,
  GetAstroObjectsQueryDto,
  PatchAstroObjectDto,
} from './dto';
import {
  AstroObjectDetailsResponse,
  AstroObjectListResponse,
  AstroObjectResponse,
} from './responses';
import { RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';

@Controller('astro-object')
@ApiTags('Astro Object')
export class AstroObjectController {
  constructor(private readonly astroObjectService: AstroObjectService) {}

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.ASTRO_OBJECT_READ)
  @Get()
  @ApiOkResponse({
    description: 'List astro objects',
    type: AstroObjectListResponse,
  })
  async list(
    @Query() query: GetAstroObjectsQueryDto,
  ): Promise<AstroObjectListResponse> {
    return this.astroObjectService.list(query);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.ASTRO_OBJECT_READ)
  @Get(':id')
  @ApiOkResponse({
    description: 'Astro object details',
    type: AstroObjectDetailsResponse,
  })
  async getById(@Param('id') id: string): Promise<AstroObjectDetailsResponse> {
    return this.astroObjectService.getById(id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.ASTRO_OBJECT_MANAGE)
  @Post()
  @ApiOkResponse({
    description: 'Created astro object',
    type: AstroObjectResponse,
  })
  async create(
    @Body() dto: CreateAstroObjectDto,
  ): Promise<AstroObjectResponse> {
    return this.astroObjectService.create(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.ASTRO_OBJECT_MANAGE)
  @Patch(':id')
  @ApiOkResponse({
    description: 'Patched astro object',
    type: AstroObjectResponse,
  })
  async patch(
    @Param('id') id: string,
    @Body() dto: PatchAstroObjectDto,
  ): Promise<AstroObjectResponse> {
    return this.astroObjectService.patch(id, dto);
  }
}

import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { GetCurrentUser, RequirePermissions } from '../../common/decorators';
import { PERMISSIONS } from '../../common/acl/permissions';
import { GrantService } from './grant.service';
import { CreateGrantDto, GetGrantsQueryDto } from './dto';
import { GrantListResponse, GrantResponse } from './responses';

@Controller('blog/grants')
@ApiTags('Blog · Access grants')
@ApiBearerAuth()
export class GrantController {
  constructor(private readonly grantService: GrantService) {}

  // ----- caller's own grants (any authenticated user) -----

  @Get('mine')
  @ApiOkResponse({ description: 'My access grants', type: GrantListResponse })
  async mine(
    @GetCurrentUser('sub') userId: string,
    @Query() query: GetGrantsQueryDto,
  ): Promise<GrantListResponse> {
    return this.grantService.listMine(userId, query);
  }

  // ----- admin (BLOG_GRANT_MANAGE) -----

  @RequirePermissions(PERMISSIONS.BLOG_GRANT_MANAGE)
  @Post()
  @ApiOkResponse({ description: 'Issued grant', type: GrantResponse })
  async issue(@Body() dto: CreateGrantDto): Promise<GrantResponse> {
    return this.grantService.issue(dto);
  }

  @RequirePermissions(PERMISSIONS.BLOG_GRANT_MANAGE)
  @Get()
  @ApiOkResponse({ description: 'List grants', type: GrantListResponse })
  async list(@Query() query: GetGrantsQueryDto): Promise<GrantListResponse> {
    return this.grantService.list(query);
  }

  @RequirePermissions(PERMISSIONS.BLOG_GRANT_MANAGE)
  @Delete(':id')
  @ApiOkResponse({ description: 'Revoked grant', type: GrantResponse })
  async revoke(@Param('id') id: string): Promise<GrantResponse> {
    return this.grantService.revoke(id);
  }
}

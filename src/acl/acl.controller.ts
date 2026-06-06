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

import { RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { AclService } from './acl.service';
import {
  CreatePermissionGroupDto,
  SetUserGroupsDto,
  UpdatePermissionGroupDto,
} from './dto';
import {
  PermissionCatalogResponseDto,
  PermissionGroupListResponseDto,
  PermissionGroupResponseDto,
} from './responses';

@ApiTags('ACL')
@ApiBearerAuth()
@Controller('acl')
export class AclController {
  constructor(private readonly aclService: AclService) {}

  @RequirePermissions(PERMISSIONS.ACL_MANAGE)
  @Get('permissions')
  @ApiOkResponse({ type: PermissionCatalogResponseDto })
  getCatalog(): PermissionCatalogResponseDto {
    return this.aclService.listCatalog();
  }

  @RequirePermissions(PERMISSIONS.ACL_MANAGE)
  @Get('groups')
  @ApiOkResponse({ type: PermissionGroupListResponseDto })
  listGroups(): Promise<PermissionGroupListResponseDto> {
    return this.aclService.listGroups();
  }

  @RequirePermissions(PERMISSIONS.ACL_MANAGE)
  @Get('groups/:id')
  @ApiOkResponse({ type: PermissionGroupResponseDto })
  getGroup(@Param('id') id: string): Promise<PermissionGroupResponseDto> {
    return this.aclService.getGroup(id);
  }

  @RequirePermissions(PERMISSIONS.ACL_MANAGE)
  @Post('groups')
  @ApiOkResponse({ type: PermissionGroupResponseDto })
  createGroup(
    @Body() dto: CreatePermissionGroupDto,
  ): Promise<PermissionGroupResponseDto> {
    return this.aclService.createGroup(dto);
  }

  @RequirePermissions(PERMISSIONS.ACL_MANAGE)
  @Patch('groups/:id')
  @ApiOkResponse({ type: PermissionGroupResponseDto })
  updateGroup(
    @Param('id') id: string,
    @Body() dto: UpdatePermissionGroupDto,
  ): Promise<PermissionGroupResponseDto> {
    return this.aclService.updateGroup(id, dto);
  }

  @RequirePermissions(PERMISSIONS.ACL_MANAGE)
  @Delete('groups/:id')
  @ApiOkResponse({ description: 'Group deleted' })
  deleteGroup(@Param('id') id: string) {
    return this.aclService.deleteGroup(id);
  }

  @RequirePermissions(PERMISSIONS.ACL_ASSIGN)
  @Get('users/:userId/groups')
  @ApiOkResponse({ type: PermissionGroupListResponseDto })
  getUserGroups(
    @Param('userId') userId: string,
  ): Promise<PermissionGroupListResponseDto> {
    return this.aclService.getUserGroups(userId);
  }

  @RequirePermissions(PERMISSIONS.ACL_ASSIGN)
  @Put('users/:userId/groups')
  @ApiOkResponse({ type: PermissionGroupListResponseDto })
  setUserGroups(
    @Param('userId') userId: string,
    @Body() dto: SetUserGroupsDto,
  ): Promise<PermissionGroupListResponseDto> {
    return this.aclService.setUserGroups(userId, dto);
  }
}

import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { GetCurrentUser, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto';
import { User } from '@prisma/client';
import {
  UserListResponseDto,
  UserResponseDto,
  UserSettingsResponseDto,
} from './responses';
import {
  PatchUserAdminDto,
  PatchUserDto,
  PatchUserSettingsDto,
  UserDto,
} from './dto';

@ApiTags('User')
@Controller('user')
@ApiBearerAuth()
export class UserController {
  constructor(private userService: UserService) {}

  @Post('create')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiOkResponse({ description: 'User created', type: UserResponseDto })
  create(@Body() dto: UserDto): Promise<UserResponseDto> {
    return this.userService.create(dto);
  }

  @RequirePermissions(PERMISSIONS.USER_READ)
  @Get('list')
  @ApiOkResponse({
    description: 'List of users with pagination',
    type: UserListResponseDto,
  })
  async getList(@Query() dto: PaginationDto): Promise<UserListResponseDto> {
    return this.userService.getMultiple(dto);
  }

  @Patch('me')
  @ApiOkResponse({ description: 'User updated', type: UserResponseDto })
  update(
    @GetCurrentUser('sub') userId: string,
    @Body() data: Partial<PatchUserDto>,
  ): Promise<UserResponseDto> {
    return this.userService.update(userId, data);
  }

  @Get('settings')
  @ApiOkResponse({
    description: 'Current user settings',
    type: UserSettingsResponseDto,
  })
  getSettings(
    @GetCurrentUser('sub') userId: string,
  ): Promise<UserSettingsResponseDto> {
    return this.userService.getSettings(userId);
  }

  @Patch('settings')
  @ApiOkResponse({
    description: 'User settings updated',
    type: UserSettingsResponseDto,
  })
  updateSettings(
    @GetCurrentUser('sub') userId: string,
    @Body() data: PatchUserSettingsDto,
  ): Promise<UserSettingsResponseDto> {
    return this.userService.updateSettings(userId, data);
  }

  @Patch('role')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  @ApiOkResponse({ description: 'User updated', type: UserResponseDto })
  updateAdmin(
    @Query('id') userId: string,
    @Body() data: PatchUserAdminDto,
  ): Promise<UserResponseDto> {
    return this.userService.update(userId, data);
  }
}

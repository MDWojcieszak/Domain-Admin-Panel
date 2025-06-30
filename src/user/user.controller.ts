import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { UserService } from 'src/user/user.service';
import { GetCurrentUser, Roles } from '../common/decorators';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto';
import { User } from '@prisma/client';
import { UserListResponseDto, UserResponseDto } from './responses';
import { PatchUserAdminDto, PatchUserDto, UserDto } from './dto';

@ApiTags('User')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Post('create')
  @Roles('OWNER')
  @ApiOkResponse({ description: 'User created', type: UserResponseDto })
  create(@Body() dto: UserDto): Promise<UserResponseDto> {
    return this.userService.create(dto);
  }

  @Roles('OWNER', 'ADMIN')
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

  @Patch('role')
  @Roles('OWNER')
  @ApiOkResponse({ description: 'User updated', type: UserResponseDto })
  updateAdmin(
    @Query('id') userId: string,
    @Body() data: PatchUserAdminDto,
  ): Promise<UserResponseDto> {
    return this.userService.update(userId, data);
  }
}

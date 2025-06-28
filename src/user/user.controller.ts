import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import { UserDto } from './dto';
import { UserService } from 'src/user/user.service';
import { Roles } from '../common/decorators';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto';
import { User } from '@prisma/client';
import { UserListResponseDto, UserResponseDto } from './responses';

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
  @Patch()
  @Roles('OWNER')
  update(@Query('id') userId: string, @Body() data: Partial<UserDto>) {
    return this.userService.update(userId, data);
  }
}

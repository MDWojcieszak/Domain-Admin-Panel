import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserDto } from './dto';
import { UserService } from 'src/user/user.service';
import { Roles } from '../common/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { PaginationDto } from '../common/dto';

@ApiTags('User')
@ApiBearerAuth()
@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Post('create')
  @Roles('OWNER')
  create(@Body() dto: UserDto) {
    return this.userService.create(dto);
  }

  @Roles('OWNER', 'ADMIN')
  @Get('list')
  async getList(@Query() dto: PaginationDto) {
    return await this.userService.getMultiple(dto);
  }
}

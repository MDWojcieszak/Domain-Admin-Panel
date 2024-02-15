import { Body, Controller, Post } from '@nestjs/common';
import { UserDto } from './dto';
import { UserService } from 'src/user/user.service';
import { Roles } from '../common/decorators';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

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
}

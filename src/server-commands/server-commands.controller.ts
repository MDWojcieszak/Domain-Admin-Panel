import { Controller, Get, Query } from '@nestjs/common';
import { ServerCommandsService } from './server-commands.service';
import { ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators';
import { MessagePattern } from '@nestjs/microservices';
import { GetServerCommandsDto, RegisterServerCommandsDto } from './dto';

@ApiTags('Server')
@Controller('server/commands')
export class ServerCommandsController {
  constructor(private serverCommandsService: ServerCommandsService) {}

  @Public()
  @Get()
  async getCommands(@Query() dto: GetServerCommandsDto) {
    return this.serverCommandsService.handleGet(dto);
  }

  @Public()
  @MessagePattern('register-commands')
  async registerServerCommands(dto: RegisterServerCommandsDto) {
    return this.serverCommandsService.handleRegisterCommands(dto);
  }
}

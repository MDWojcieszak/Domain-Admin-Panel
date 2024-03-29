import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ServerCommandsService } from './server-commands.service';
import { ApiTags } from '@nestjs/swagger';
import { GetCurrentUser, Public, Roles } from '../common/decorators';
import { MessagePattern } from '@nestjs/microservices';
import {
  GetServerCommandsDto,
  PatchServerCommandDto,
  RegisterServerCommandsDto,
} from './dto';
import { UpdateServerCommandDto } from './dto/update-server-command.dto';

@ApiTags('Server')
@Controller('server/commands')
export class ServerCommandsController {
  constructor(private serverCommandsService: ServerCommandsService) {}

  @Roles('ADMIN', 'OWNER')
  @Get('all')
  async getCommands(@Query() dto: GetServerCommandsDto) {
    return this.serverCommandsService.handleGet(dto);
  }

  @Roles('ADMIN', 'OWNER')
  @Patch(':id')
  async putCommand(
    @Param('id') id: string,
    @Body() dto: PatchServerCommandDto,
  ) {
    return this.serverCommandsService.handlePatch(id, dto);
  }

  @Roles('ADMIN', 'OWNER')
  @Post('send/:id')
  startServer(@Param('id') id: string, @GetCurrentUser('sub') userId: string) {
    return this.serverCommandsService.handleSend(id, userId);
  }

  @Public()
  @MessagePattern('commands.register')
  async registerServerCommands(dto: RegisterServerCommandsDto) {
    return this.serverCommandsService.handleRegisterCommands(dto);
  }

  @Public()
  @MessagePattern('commands.update')
  async updateServerCommand(dto: UpdateServerCommandDto) {
    return this.serverCommandsService.handleUpdateCommand(dto);
  }
}

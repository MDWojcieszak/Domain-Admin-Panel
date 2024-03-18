import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
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

@ApiTags('Server')
@Controller('server/commands')
export class ServerCommandsController {
  constructor(private serverCommandsService: ServerCommandsService) {}

  @Roles('ADMIN', 'OWNER')
  @Get()
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
  @MessagePattern('register-commands')
  async registerServerCommands(dto: RegisterServerCommandsDto) {
    return this.serverCommandsService.handleRegisterCommands(dto);
  }
}

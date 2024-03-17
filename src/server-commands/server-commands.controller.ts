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
import { Public } from '../common/decorators';
import { MessagePattern } from '@nestjs/microservices';
import {
  GetServerCommandsDto,
  PatchServerCommandDto,
  RegisterServerCommandsDto,
  SendCommandDto,
} from './dto';

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
  @Patch(':id')
  async putCommand(
    @Param('id') id: string,
    @Body() dto: PatchServerCommandDto,
  ) {
    return this.serverCommandsService.handlePatch(id, dto);
  }

  @Public()
  @Post('send/:id')
  startServer(@Param('id') id: string, dto: SendCommandDto) {
    return this.serverCommandsService.handleSend(id, dto);
  }

  // @Roles('OWNER', 'ADMIN')
  // @Post('stop')
  // stopServer() {
  //   return this.serverService.stopServer();
  // }

  @Public()
  @MessagePattern('register-commands')
  async registerServerCommands(dto: RegisterServerCommandsDto) {
    return this.serverCommandsService.handleRegisterCommands(dto);
  }
}

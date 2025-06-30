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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser, Public, Roles } from '../common/decorators';
import { MessagePattern } from '@nestjs/microservices';
import {
  GetServerCommandsDto,
  PatchServerCommandDto,
  RegisterServerCommandsDto,
} from './dto';
import { UpdateServerCommandDto } from './dto/update-server-command.dto';
import {
  CommandExecuteResponseDto,
  CommandListResponseDto,
  CommandResponseDto,
} from './responses';

@ApiTags('Server')
@Controller('server/commands')
export class ServerCommandsController {
  constructor(private serverCommandsService: ServerCommandsService) {}

  @ApiBearerAuth()
  @Roles('ADMIN', 'OWNER')
  @Get('all')
  @ApiOkResponse({
    type: CommandListResponseDto,
  })
  async getCommands(
    @Query() dto: GetServerCommandsDto,
  ): Promise<CommandListResponseDto> {
    return this.serverCommandsService.handleGet(dto);
  }
  @ApiBearerAuth()
  @Roles('ADMIN', 'OWNER')
  @Patch(':id')
  @ApiOkResponse({
    type: CommandResponseDto,
  })
  async putCommand(
    @Param('id') id: string,
    @Body() dto: PatchServerCommandDto,
  ): Promise<CommandResponseDto> {
    return this.serverCommandsService.handlePatch(id, dto);
  }

  @ApiBearerAuth()
  @Roles('ADMIN', 'OWNER')
  @Post('send/:id')
  @ApiOkResponse({
    type: CommandExecuteResponseDto,
  })
  startServer(
    @Param('id') id: string,
    @GetCurrentUser('sub') userId: string,
  ): Promise<CommandExecuteResponseDto> {
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

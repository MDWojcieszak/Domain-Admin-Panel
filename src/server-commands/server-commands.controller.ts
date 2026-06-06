import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ServerCommandsService } from './server-commands.service';
import { CommandProgressMarkerService } from './command-progress-marker.service';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GetCurrentUser, Public, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { MessagePattern } from '@nestjs/microservices';
import {
  CreateCommandProgressMarkerDto,
  GetServerCommandsDto,
  PatchServerCommandDto,
  RegisterServerCommandsDto,
  UpdateCommandProgressMarkerDto,
} from './dto';
import { UpdateServerCommandDto } from './dto/update-server-command.dto';
import {
  CommandExecuteResponseDto,
  CommandListResponseDto,
  CommandProgressMarkerListResponseDto,
  CommandProgressMarkerResponseDto,
  CommandResponseDto,
} from './responses';

@ApiTags('Server')
@Controller('server/commands')
export class ServerCommandsController {
  constructor(
    private serverCommandsService: ServerCommandsService,
    private commandProgressMarkerService: CommandProgressMarkerService,
  ) {}

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COMMAND_READ)
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
  @RequirePermissions(PERMISSIONS.COMMAND_MANAGE)
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
  @RequirePermissions(PERMISSIONS.COMMAND_EXECUTE)
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

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COMMAND_READ)
  @Get(':id/markers')
  @ApiOkResponse({
    type: CommandProgressMarkerListResponseDto,
  })
  async getProgressMarkers(
    @Param('id') id: string,
  ): Promise<CommandProgressMarkerListResponseDto> {
    return this.commandProgressMarkerService.list(id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COMMAND_MANAGE)
  @Post(':id/markers')
  @ApiOkResponse({
    type: CommandProgressMarkerResponseDto,
  })
  async createProgressMarker(
    @Param('id') id: string,
    @Body() dto: CreateCommandProgressMarkerDto,
  ): Promise<CommandProgressMarkerResponseDto> {
    return this.commandProgressMarkerService.create(id, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COMMAND_MANAGE)
  @Patch('markers/:markerId')
  @ApiOkResponse({
    type: CommandProgressMarkerResponseDto,
  })
  async updateProgressMarker(
    @Param('markerId') markerId: string,
    @Body() dto: UpdateCommandProgressMarkerDto,
  ): Promise<CommandProgressMarkerResponseDto> {
    return this.commandProgressMarkerService.update(markerId, dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.COMMAND_MANAGE)
  @Delete('markers/:markerId')
  @ApiOkResponse({
    type: CommandProgressMarkerResponseDto,
  })
  async deleteProgressMarker(
    @Param('markerId') markerId: string,
  ): Promise<CommandProgressMarkerResponseDto> {
    return this.commandProgressMarkerService.remove(markerId);
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

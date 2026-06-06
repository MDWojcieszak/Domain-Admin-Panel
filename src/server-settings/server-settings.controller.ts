import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ServerSettingsService } from './server-settings.service';
import { Public, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { MessagePattern } from '@nestjs/microservices';
import {
  GetServerSettingsDto,
  PatchServerSettingDto,
  RegisterServerSettingsDto,
} from './dto';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import {
  ServerSettingsListResponseDto,
  ServerSettingsResponseDto,
} from './responses';

@ApiTags('Server')
@Controller('server/settings')
export class ServerSettingsController {
  constructor(private serverSettingsService: ServerSettingsService) {}

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SETTINGS_READ)
  @Get()
  @ApiOkResponse({ type: ServerSettingsListResponseDto })
  async getSettings(
    @Query() dto: GetServerSettingsDto,
  ): Promise<ServerSettingsListResponseDto> {
    return this.serverSettingsService.handleGet(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.SETTINGS_MANAGE)
  @Patch(':id')
  @ApiOkResponse({ type: ServerSettingsResponseDto })
  async putCommand(
    @Param('id') id: string,
    @Body() dto: PatchServerSettingDto,
  ): Promise<ServerSettingsResponseDto> {
    return this.serverSettingsService.handlePatch(id, dto);
  }

  @Public()
  @MessagePattern('settings.register')
  async registerServerConfig(dto: RegisterServerSettingsDto) {
    return this.serverSettingsService.handleRegisterSettings(dto);
  }
}

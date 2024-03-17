import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ServerSettingsService } from './server-settings.service';
import { Public } from '../common/decorators';
import { MessagePattern } from '@nestjs/microservices';
import {
  GetServerSettingsDto,
  PatchServerSettingDto,
  RegisterServerSettingsDto,
} from './dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Server')
@Controller('server/settings')
export class ServerSettingsController {
  constructor(private serverSettingsService: ServerSettingsService) {}

  @Public()
  @Get()
  async getSettings(@Query() dto: GetServerSettingsDto) {
    return this.serverSettingsService.handleGet(dto);
  }

  @Public()
  @Patch(':id')
  async putCommand(
    @Param('id') id: string,
    @Body() dto: PatchServerSettingDto,
  ) {
    return this.serverSettingsService.handlePatch(id, dto);
  }

  @Public()
  @MessagePattern('register-settings')
  async registerServerConfig(dto: RegisterServerSettingsDto) {
    return this.serverSettingsService.handleRegisterSettings(dto);
  }
}

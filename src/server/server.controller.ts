import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ServerService } from './server.service';
import { Public, Roles } from '../common/decorators';
import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { validate } from 'class-validator';
import { ProcessMessageDto } from './dto/process-message.dto';
import {
  RegisterServerCommandsDto,
  RegisterServerDto,
  RegisterServerSettingsDto,
  ServerPropertiesDto,
} from './dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Server')
@Controller('server')
export class ServerController {
  constructor(private serverService: ServerService) {}

  @Public()
  @Post('start')
  startServer() {
    return this.serverService.startServer();
  }

  @Roles('OWNER', 'ADMIN')
  @Post('stop')
  stopServer() {
    return this.serverService.stopServer();
  }

  @Public()
  @Post('properties')
  getProperties() {
    return this.serverService.getProperties();
  }

  @Public()
  @MessagePattern('raport-server-usage')
  async raportServerUsage(dto: ServerPropertiesDto) {
    return this.serverService.updateServerProperties(dto);
  }

  @Public()
  @MessagePattern('register-server')
  async registerServer(dto: RegisterServerDto) {
    return this.serverService.handleRegisterServer(dto);
  }

  @Public()
  @MessagePattern('register-commands')
  async registerServerCommands(dto: RegisterServerCommandsDto) {
    return this.serverService.handleRegisterCommands(dto);
  }

  @Public()
  @MessagePattern('register-settings')
  async registerServerConfig(dto: RegisterServerSettingsDto) {
    return this.serverService.handleRegisterSettings(dto);
  }

  @Public()
  @EventPattern('process-message')
  async registerMessage(dto: ProcessMessageDto) {
    const errors = await validate(dto);
    if (errors.length > 0) {
      console.log(errors);
      return new BadRequestException(errors);
    }
    console.log(dto.message);
  }

  @Public()
  @EventPattern('server-status')
  setStatus(data: any) {
    console.warn(data);
  }
}

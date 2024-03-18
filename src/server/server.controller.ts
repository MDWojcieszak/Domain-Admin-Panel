import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { ServerService } from './server.service';
import { Public, Roles } from '../common/decorators';
import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { validate } from 'class-validator';
import { ProcessMessageDto } from './dto/process-message.dto';
import { GetServerDto, RegisterServerDto, ServerPropertiesDto } from './dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Server')
@Controller('server')
export class ServerController {
  constructor(private serverService: ServerService) {}

  @Roles('ADMIN', 'OWNER')
  @Get('')
  async get(@Query() dto: GetServerDto) {
    return this.serverService.handleGet(dto.id);
  }

  @Roles('ADMIN', 'OWNER')
  @Get('all')
  async getAll() {
    return this.serverService.handleGetAll();
  }

  @Public()
  @MessagePattern('register-server')
  async registerServer(dto: RegisterServerDto) {
    return this.serverService.handleRegisterServer(dto);
  }

  @Public()
  @MessagePattern('raport-server-usage')
  async raportServerUsage(dto: ServerPropertiesDto) {
    return this.serverService.updateServerProperties(dto);
  }
}

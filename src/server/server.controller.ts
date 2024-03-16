import { BadRequestException, Controller, Post } from '@nestjs/common';
import { ServerService } from './server.service';
import { Public, Roles } from '../common/decorators';
import { EventPattern, MessagePattern } from '@nestjs/microservices';
import { validate } from 'class-validator';
import { ProcessMessageDto } from './dto/process-message.dto';
import { RegisterServerDto, ServerPropertiesDto } from './dto';
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

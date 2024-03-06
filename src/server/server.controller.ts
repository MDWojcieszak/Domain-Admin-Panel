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
import { RegisterServerDto, ServerPropertiesDto } from './dto';

@Controller('server')
export class ServerController {
  constructor(private serverService: ServerService) {}

  // @Post()
  // async createServer(@Body() server: Server): Promise<Server> {
  //   return this.serverService.createServer(server);
  // }

  // // Get all servers
  // @Get()
  // async getServers(): Promise<Server[]> {
  //   return this.serverService.getServers();
  // }

  // // Get server by ID
  // @Get(':id')
  // async getServerById(@Param('id') id: string): Promise<Server> {
  //   return this.serverService.getServerById(id);
  // }

  // // Update server by ID
  // @Put(':id')
  // async updateServer(@Param('id') id: string, @Body() server: Server): Promise<Server> {
  //   return this.serverService.updateServer(id, server);
  // }

  // // Delete server by ID
  // @Delete(':id')
  // async deleteServer(@Param('id') id: string): Promise<void> {
  //   return this.serverService.deleteServer(id);
  // }

  // @Roles('OWNER', 'ADMIN')
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
    return this.serverService.registerServer(dto);
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

  @EventPattern('status')
  setStatus(data: any) {
    console.warn(data);
  }
}

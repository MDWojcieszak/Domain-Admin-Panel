import { Controller, Get, Param, Query } from '@nestjs/common';
import { ServerProcessService } from './server-process.service';
import { Public, Roles } from '../common/decorators';
import { EventPattern, MessagePattern } from '@nestjs/microservices';
import {
  ProcessStatusDto,
  RegisterProcessDto,
  RegisterProcessLogDto,
} from './dto';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ProcessListResponseDto, ProcessResponseDto } from './responses';
import { PaginationDto } from '../common/dto';
import { ProcessLogListResponseDto } from './responses/process-log-list-response.dto';
import { Role } from '@prisma/client';

@ApiTags('Server')
@Controller('server/process')
export class ServerProcessController {
  constructor(private serverProcessService: ServerProcessService) {}

  @Roles('ADMIN', 'OWNER')
  @Get('list')
  @ApiOkResponse({
    type: ProcessListResponseDto,
  })
  async getAll(@Query() dto: PaginationDto): Promise<ProcessListResponseDto> {
    return this.serverProcessService.handleGetAll(dto);
  }

  @Roles('ADMIN', 'OWNER')
  @Get(':id')
  @ApiOkResponse({
    type: ProcessResponseDto,
  })
  async getOne(@Param('id') id: string): Promise<ProcessResponseDto> {
    return this.serverProcessService.handleGetOne(id);
  }

  @Roles('ADMIN', 'OWNER')
  @Get(':id/logs')
  @ApiOkResponse({
    type: ProcessLogListResponseDto,
  })
  async getAllLogs(
    @Param('id') id: string,
    @Query() dto: PaginationDto,
  ): Promise<ProcessLogListResponseDto> {
    return this.serverProcessService.handleGetAllLogs(id, dto);
  }

  @Public()
  @MessagePattern('process.register')
  async registerProcess(dto: RegisterProcessDto) {
    return this.serverProcessService.handleRegister(dto);
  }

  @Public()
  @EventPattern('process.status')
  async changeStatus(dto: ProcessStatusDto) {
    this.serverProcessService.handleChangeStatus(dto);
  }

  @Public()
  @EventPattern('process.register-log')
  async registerProcessMessage(dto: RegisterProcessLogDto) {
    this.serverProcessService.handleRegisterLog(dto);
  }
}

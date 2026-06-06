import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { ServerProcessService } from './server-process.service';
import { Public, RequirePermissions } from '../common/decorators';
import { PERMISSIONS } from '../common/acl/permissions';
import { EventPattern, MessagePattern } from '@nestjs/microservices';
import {
  ProcessStatusDto,
  RegisterProcessDto,
  RegisterProcessLogDto,
} from './dto';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ProcessListResponseDto, ProcessResponseDto } from './responses';
import { PaginationDto } from '../common/dto';
import { ProcessLogListResponseDto } from './responses/process-log-list-response.dto';

@ApiTags('Server')
@Controller('server/process')
export class ServerProcessController {
  constructor(private serverProcessService: ServerProcessService) {}

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PROCESS_READ)
  @Get('all')
  @ApiOkResponse({
    type: ProcessListResponseDto,
  })
  async getAll(@Query() dto: PaginationDto): Promise<ProcessListResponseDto> {
    return this.serverProcessService.handleGetAll(dto);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PROCESS_READ)
  @Get(':id')
  @ApiOkResponse({
    type: ProcessResponseDto,
  })
  async getOne(@Param('id') id: string): Promise<ProcessResponseDto> {
    return this.serverProcessService.handleGetOne(id);
  }

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PROCESS_READ)
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

  @ApiBearerAuth()
  @RequirePermissions(PERMISSIONS.PROCESS_DELETE)
  @Delete(':id')
  @ApiOkResponse({ description: 'Process deleted' })
  async delete(@Param('id') id: string) {
    return this.serverProcessService.handleDelete(id);
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

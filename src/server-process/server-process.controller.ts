import { Controller } from '@nestjs/common';
import { ServerProcessService } from './server-process.service';
import { Public } from '../common/decorators';
import { EventPattern, MessagePattern } from '@nestjs/microservices';
import {
  ProcessStatusDto,
  RegisterProcessDto,
  RegisterProcessLogDto,
} from './dto';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Server')
@Controller('server/process')
export class ServerProcessController {
  constructor(private serverProcessService: ServerProcessService) {}

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

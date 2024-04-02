import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProcessStatusDto,
  RegisterProcessDto,
  RegisterProcessLogDto,
} from './dto';
import { ServerProcessStatus } from '@prisma/client';

@Injectable()
export class ServerProcessService {
  constructor(private prisma: PrismaService) {}

  async handleRegister(dto: RegisterProcessDto) {
    try {
      const process = await this.prisma.process.create({
        data: {
          name: dto.name,
          status: ServerProcessStatus.UNKNOWN,
          startedBy: { connect: { id: dto.userId } },
          category: { connect: { id: dto.categoryId } },
        },
      });
      return process.id;
    } catch (e) {
      Logger.log(e);
      return false;
    }
  }

  async handleChangeStatus(dto: ProcessStatusDto) {
    try {
      await this.prisma.process.update({
        where: { id: dto.processId },
        data: {
          status: dto.status,
        },
      });
    } catch (e) {
      Logger.log(e);
    }
  }

  async handleRegisterLog(dto: RegisterProcessLogDto) {
    try {
      await this.prisma.processLog.create({
        data: {
          message: dto.message,
          process: { connect: { id: dto.processId } },
          level: dto.level,
        },
      });
    } catch (e) {
      Logger.log(e);
    }
  }
}

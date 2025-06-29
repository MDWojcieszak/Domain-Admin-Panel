import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  ProcessStatusDto,
  RegisterProcessDto,
  RegisterProcessLogDto,
} from './dto';
import { ServerProcessStatus } from '@prisma/client';
import { PaginationDto } from '../common/dto';

@Injectable()
export class ServerProcessService {
  constructor(private prisma: PrismaService) {}

  async handleGetAll(dto: PaginationDto) {
    const total = await this.prisma.process.count();
    const processes = await this.prisma.process.findMany({
      take: dto.take,
      skip: dto.skip,
      select: {
        id: true,
        name: true,
        status: true,
        startedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        startedAt: true,
        stoppedAt: true,
      },
      orderBy: { startedAt: 'desc' },
    });
    return { processes, total, params: dto };
  }

  async handleGetOne(processId: string) {
    const process = await this.prisma.process.findUnique({
      where: { id: processId },
      select: {
        id: true,
        name: true,
        status: true,
        startedBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        category: {
          select: {
            id: true,
            name: true,
          },
        },
        startedAt: true,
        stoppedAt: true,
      },
    });
    return process;
  }

  async handleGetAllLogs(processId: string, dto: PaginationDto) {
    const total = await this.prisma.processLog.count({
      where: { processId },
    });
    const logs = await this.prisma.processLog.findMany({
      where: { processId },
      select: {
        id: true,
        message: true,
        level: true,
        timestamp: true,
      },
      take: dto.take,
      skip: dto.skip,
      orderBy: { timestamp: 'desc' },
    });
    return { logs, total, params: dto };
  }

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

import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import { validate } from 'class-validator';
import {
  DiskInfoDto,
  LoadDto,
  MemoryDto,
  RegisterServerDto,
  ServerPropertiesDto,
} from './dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ServerService {
  constructor(
    @Inject('MULTIVERSE_SERVICE') private multiVerseClient: ClientProxy,
    private prisma: PrismaService,
  ) {}

  async startServer() {
    try {
      return await firstValueFrom(
        this.multiVerseClient.send('start_server', {}),
      );
    } catch (e) {
      return e;
    }
  }

  async stopServer() {
    try {
      return await firstValueFrom(
        this.multiVerseClient.send('stop_server', {}),
      );
    } catch (e) {
      return e;
    }
  }

  async getProperties() {
    try {
      return await firstValueFrom(
        this.multiVerseClient.send('get_system_usage', {}),
      );
    } catch (e) {
      return e;
    }
  }

  async registerServer(dto: RegisterServerDto) {
    try {
      const existingServer = await this.prisma.server.findFirst({
        where: {
          name: dto.name,
        },
        select: { id: true, properties: { select: { diskInfo: true } } },
      });
      if (
        existingServer &&
        existingServer.properties.diskInfo.length === dto.diskCount
      ) {
        Logger.log(`Server ${dto.name} already registered`);
        return true;
      }
      if (existingServer) {
        await this.prisma.server.delete({
          where: {
            id: existingServer.id,
          },
        });
      }
      const server = await this.prisma.server.create({
        data: {
          name: dto.name,
          ipAddress: dto.ipAddress,
        },
      });

      const serverProperties = await this.prisma.serverProperties.create({
        data: {
          server: { connect: { id: server.id } },
        },
      });

      await this.prisma.cPUInfo.create({
        data: {
          cores: dto.cpu.cores,
          physicalCores: dto.cpu.physicalCores,
          ServerProperties: { connect: { id: serverProperties.id } },
        },
      });

      await this.prisma.memoryInfo.create({
        data: {
          ServerProperties: { connect: { id: serverProperties.id } },
        },
      });

      await Promise.all(
        Array.from(new Array(dto.diskCount)).map(async () => {
          return await this.createDiskInfo(serverProperties.id);
        }),
      );
      return true;
    } catch (error) {
      throw new Error(`Failed to register server: ${error.message}`);
    }
  }

  async createDiskInfo(serverPropertiesId: string) {
    return await this.prisma.diskInfo.create({
      data: {
        ServerProperties: { connect: { id: serverPropertiesId } },
      },
    });
  }

  async updateServerProperties(dto: ServerPropertiesDto) {
    try {
      const server = await this.prisma.server.findFirst({
        where: { name: dto.name },
        include: {
          properties: {
            include: {
              cpuInfo: true,
              memoryInfo: true,
              diskInfo: true,
            },
          },
        },
      });

      if (!server) {
        throw new Error('Server not found');
      }
      if (dto.cpu) {
        await this.updateCpuInfo(server.properties.cpuInfo.id, dto.cpu);
      }
      if (dto.memory) {
        await this.updateMemoryInfo(
          server.properties.memoryInfo.id,
          dto.memory,
        );
      }
      if (dto.disk) {
        await Promise.all(
          dto.disk.map(async (disk, index) => {
            if (!server.properties.diskInfo[index])
              throw new Error('Incorrect number of disks');
            return await this.updateDiskInfo(
              server.properties.diskInfo[index].id,
              disk,
            );
          }),
        );
      }
      await this.prisma.serverProperties.update({
        where: { id: server.properties.id },
        data: { status: 'ONLINE', uptime: dto.uptime },
        include: {
          cpuInfo: true,
          memoryInfo: true,
          diskInfo: true,
        },
      });

      return true;
    } catch (error) {
      throw new Error(`Failed to update server properties: ${error.message}`);
    }
  }

  async updateCpuInfo(id: string, cpuInfo: LoadDto) {
    await this.prisma.cPUInfo.update({
      where: { id },
      data: cpuInfo,
    });
  }

  async updateMemoryInfo(id: string, memoryInfo: MemoryDto) {
    await this.prisma.memoryInfo.update({
      where: { id },
      data: memoryInfo,
    });
  }

  async updateDiskInfo(id: string, diskInfo: DiskInfoDto) {
    await this.prisma.diskInfo.update({
      where: { id },
      data: diskInfo,
    });
  }

  async onApplicationBootstrap() {
    this.multiVerseClient
      .connect()
      .then(() => console.log('connected to QUEUE'))
      .catch((e) => console.log(e));
  }
}

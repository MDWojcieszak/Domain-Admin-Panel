import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom } from 'rxjs';
import {
  DiskInfoDto,
  GetServerDto,
  LoadDto,
  MemoryDto,
  PatchDiskDto,
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

  async handleGet(id: string) {
    const server = this.prisma.server.findUnique({
      where: { id },
    });
    if (!server) throw new ForbiddenException();
    return server;
  }

  async handleGetAll() {
    const total = await this.prisma.server.count();

    const servers = await this.prisma.server.findMany({
      include: {
        properties: {
          select: {
            createdAt: true,
            status: true,
            uptime: true,
            diskInfo: true,
            cpuInfo: true,
            memoryInfo: true,
          },
        },
      },
    });
    return { total, servers };
  }

  async handleGetCategories(dto: GetServerDto) {
    const categories = await this.prisma.serverCategory.findMany({
      where: { serverId: dto.id },
    });
    if (!categories) throw new ForbiddenException();
    return categories;
  }

  async handleGetDisks(dto: GetServerDto) {
    const disks = await this.prisma.diskInfo.findMany({
      where: { ServerProperties: { server: { id: dto.id } } },
    });
    return disks;
  }

  async handlePatchDisk(id: string, dto: PatchDiskDto) {
    const disk = await this.prisma.diskInfo.findUnique({ where: { id } });
    if (!disk) throw new ForbiddenException();

    const updatedDisk = await this.prisma.diskInfo.update({
      where: { id: disk.id },
      data: {
        mediaType: dto.mediaType,
        name: dto.name,
      },
    });
    return updatedDisk;
  }

  async handleRegisterServer(dto: RegisterServerDto) {
    try {
      const existingServer = await this.prisma.server.findUnique({
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

  async find(serverName: string) {
    const session = await this.prisma.server.findUnique({
      where: { name: serverName },
    });
    if (!session) throw new ForbiddenException();
    return session;
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

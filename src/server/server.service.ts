import { ForbiddenException, Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import {
  DiskInfoDto,
  GetServerDto,
  CpuDto,
  MemoryDto,
  PatchDiskDto,
  RegisterServerDto,
  HeartbeatDto,
} from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { PaginationDto } from '../common/dto';
import { UpdateServerPropertiesDto } from './dto/updateServerProperties.dto';

@Injectable()
export class ServerService {
  constructor(
    @Inject('MULTIVERSE_SERVICE') private multiVerseClient: ClientProxy,
    private prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async handleGet(id: string) {
    const server = this.prisma.server.findUnique({
      where: { id },
    });
    if (!server) throw new ForbiddenException();
    return server;
  }

  async handleGetAll(dto: PaginationDto) {
    const total = await this.prisma.server.count();

    const servers = await this.prisma.server.findMany({
      take: dto.take,
      skip: dto.skip,
    });
    return { total, servers, params: dto };
  }

  async handleGetDetails(id: string) {
    const server = this.prisma.server.findUnique({
      where: { id },

      select: {
        createdAt: true,
        categories: { select: { id: true, name: true, value: true } },
        id: true,
        ipAddress: true,
        location: true,
        name: true,
        updatedAt: true,
        properties: {
          select: {
            startedBy: {
              select: {
                firstName: true,
                lastName: true,
                role: true,
                email: true,
              },
            },
            cpuInfo: {
              select: {
                cores: true,
                physicalCores: true,
                currentLoad: true,
                currentLoadSystem: true,
                currentLoadUser: true,
              },
            },
            diskInfo: {
              select: {
                available: true,
                fs: true,
                id: true,
                mediaType: true,
                name: true,
                type: true,
                used: true,
              },
            },
            memoryInfo: { select: { free: true, id: true, total: true } },
            uptime: true,
            status: true,
            isOnline: true,
            lastSeenAt: true,
          },
        },
      },
    });
    if (!server) throw new ForbiddenException();
    return server;
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

  async handlePatchCategory(id: string, dto: PatchDiskDto) {
    const category = await this.prisma.serverCategory.findUnique({
      where: { id },
    });
    if (!category) throw new ForbiddenException();

    const updatedCategory = await this.prisma.serverCategory.update({
      where: { id: id },
      data: {
        name: dto.name,
      },
    });
    return updatedCategory;
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

  async updateServerProperties(dto: UpdateServerPropertiesDto) {
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
      if (dto.properties.cpuInfo) {
        await this.updateCpuInfo(
          server.properties.cpuInfo.id,
          dto.properties.cpuInfo,
        );
      }
      if (dto.properties.memoryInfo) {
        await this.updateMemoryInfo(
          server.properties.memoryInfo.id,
          dto.properties.memoryInfo,
        );
      }
      if (dto.properties.diskInfo) {
        await Promise.all(
          dto.properties.diskInfo.map(async (disk, index) => {
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
        data: { status: 'ONLINE', uptime: dto.properties.uptime },
        include: {
          cpuInfo: true,
          memoryInfo: true,
          diskInfo: true,
        },
      });
      this.websocketGateway.sendToAll('server.update', server.id);
      return true;
    } catch (error) {
      throw new Error(`Failed to update server properties: ${error.message}`);
    }
  }

  async updateCpuInfo(id: string, cpuInfo: CpuDto) {
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

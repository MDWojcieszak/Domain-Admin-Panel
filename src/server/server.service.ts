import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import {
  DiskInfoDto,
  GetServerDto,
  CpuDto,
  MemoryDto,
  PatchDiskDto,
  RegisterServerDto,
  CreateServerCategoryDto,
} from './dto';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketGateway, WsRoom } from '../websocket/websocket.gateway';
import { PaginationDto } from '../common/dto';
import { UpdateServerPropertiesDto } from './dto/updateServerProperties.dto';
import { PatchServerCategoryDto } from './dto/patch-category.dto';
import { CategorySource, Prisma } from '@prisma/client';
import { ServerPowerService } from './server-power.service';

/** Compact status projection for list/single fetches (badge + wake progress). */
const STATUS_SUMMARY_SELECT = {
  status: true,
  isOnline: true,
  lastSeenAt: true,
  statusChangedAt: true,
} satisfies Prisma.ServerPropertiesSelect;

@Injectable()
export class ServerService {
  constructor(
    private prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly serverPower: ServerPowerService,
  ) {}

  async handleGet(id: string) {
    const server = this.prisma.server.findUnique({
      where: { id },
      include: { properties: { select: STATUS_SUMMARY_SELECT } },
    });
    if (!server) throw new ForbiddenException();
    return server;
  }

  async handleGetAll(dto: PaginationDto) {
    const total = await this.prisma.server.count();

    const servers = await this.prisma.server.findMany({
      take: dto.take,
      skip: dto.skip,
      include: { properties: { select: STATUS_SUMMARY_SELECT } },
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
            statusChangedAt: true,
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

  async handlePatchCategory(id: string, dto: PatchServerCategoryDto) {
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

  async handleCreateCategory(serverId: string, dto: CreateServerCategoryDto) {
    const category = await this.prisma.serverCategory.create({
      data: {
        name: dto.name,
        value: dto.value,
        source: CategorySource.MAIN,
        server: { connect: { id: serverId } },
      },
    });
    return category;
  }

  async handleRegisterServer(dto: RegisterServerDto) {
    try {
      const existing = await this.prisma.server.findUnique({
        where: { name: dto.name },
        include: {
          properties: { include: { diskInfo: true } },
        },
      });

      if (existing) {
        await this.prisma.server.update({
          where: { id: existing.id },
          data: {
            ipAddress: dto.ipAddress,
            macAddress: dto.macAddress,
            queueName: dto.queueName,
            isDeleted: false,
          },
        });

        let props = existing.properties;
        if (!props) {
          props = await this.prisma.serverProperties.create({
            data: { server: { connect: { id: existing.id } } },
            include: { diskInfo: true },
          });
        }

        await this.prisma.cPUInfo.upsert({
          where: { serverPropertiesId: props.id },
          create: {
            cores: dto.cpu.cores,
            physicalCores: dto.cpu.physicalCores,
            ServerProperties: { connect: { id: props.id } },
          },
          update: {
            cores: dto.cpu.cores,
            physicalCores: dto.cpu.physicalCores,
          },
        });

        await this.prisma.memoryInfo.upsert({
          where: { serverPropertiesId: props.id },
          create: {
            ServerProperties: { connect: { id: props.id } },
          },
          update: {},
        });

        const currentCount = props.diskInfo?.length ?? 0;

        if (currentCount < dto.diskCount) {
          const missing = dto.diskCount - currentCount;
          await Promise.all(
            Array.from({ length: missing }).map(() =>
              this.createDiskInfo(props.id),
            ),
          );
          Logger.log(
            `Server ${dto.name} diskInfo extended: ${currentCount} -> ${dto.diskCount}`,
          );
        } else if (currentCount > dto.diskCount) {
          const toDelete = props.diskInfo.slice(dto.diskCount);
          await this.prisma.diskInfo.deleteMany({
            where: { id: { in: toDelete.map((d) => d.id) } },
          });
          Logger.log(
            `Server ${dto.name} diskInfo reduced: ${currentCount} -> ${dto.diskCount}`,
          );
        }

        Logger.log(`Server ${dto.name} re-registered (updated)`);
        // Register is the first sign of life → mark online immediately.
        await this.serverPower.markPresence(existing.id);
        return true;
      }

      const server = await this.prisma.server.create({
        data: {
          name: dto.name,
          queueName: dto.queueName,
          ipAddress: dto.ipAddress,
          macAddress: dto.macAddress,
          isDeleted: false,
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
        Array.from({ length: dto.diskCount }).map(() =>
          this.createDiskInfo(serverProperties.id),
        ),
      );

      Logger.log(`Server ${dto.name} registered (created)`);
      await this.serverPower.markPresence(server.id);
      return true;
    } catch (error: any) {
      Logger.error(error);
      throw new Error(`Failed to register server: ${error?.message ?? error}`);
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
      this.websocketGateway.emitToRoom(
        WsRoom.SERVERS,
        'server.update',
        server.id,
      );
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
}

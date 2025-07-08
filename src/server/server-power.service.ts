import {
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HeartbeatDto } from './dto';
import { ClientProxy } from '@nestjs/microservices';
import { wake } from 'wol';
import { ServerStatus } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { PowerServerEvent } from './events';

@Injectable()
export class ServerPowerService {
  constructor(
    @Inject('MULTIVERSE_SERVICE') private multiVerseClient: ClientProxy,
    private prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  async handleHeartbeat(dto: HeartbeatDto) {
    try {
      const server = await this.prisma.server.findUnique({
        where: { name: dto.name },
      });
      if (!server) throw new ForbiddenException();

      await this.prisma.serverProperties.update({
        where: { serverId: server.id },
        data: {
          lastSeenAt: new Date(),
        },
      });
      return true;
    } catch (error) {
      Logger.error(`Failed to handle heartbeat: ${error.message}`);
      return false;
    }
  }

  @Cron(CronExpression.EVERY_5_SECONDS)
  async monitorServerStatuses() {
    const treshold = new Date(Date.now() - 6_000);

    const offlineServers = await this.prisma.serverProperties.findMany({
      where: {
        lastSeenAt: { lt: treshold },
        isOnline: true,
      },
      select: { id: true },
    });

    const backOnlineServers = await this.prisma.serverProperties.findMany({
      where: {
        lastSeenAt: { gte: treshold },
        isOnline: false,
      },
      select: { id: true },
    });

    await this.prisma.serverProperties.updateMany({
      where: { id: { in: offlineServers.map((s) => s.id) } },
      data: { isOnline: false },
    });

    await this.prisma.serverProperties.updateMany({
      where: { id: { in: backOnlineServers.map((s) => s.id) } },
      data: { isOnline: true },
    });

    offlineServers.forEach((server) => {
      this.websocketGateway.sendToAll('server.offline', server.id);
    });

    backOnlineServers.forEach((server) => {
      this.websocketGateway.sendToAll('server.online', server.id);
    });

    //TODO: Implement user email notifications for offline and online servers
  }

  async handleStartServer(serverId: string, userId: string) {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      include: { properties: true },
    });

    if (!server || !server.macAddress) {
      throw new NotFoundException('Server not found or missing MAC address');
    }

    const wakeSent = await this.handleWakeOnLan(server.macAddress);

    if (wakeSent) {
      await this.prisma.serverProperties.update({
        where: { serverId },
        data: {
          startedBy: { connect: { id: userId } },
          status: ServerStatus.WAKE_IN_PROGRESS,
        },
      });

      return {
        success: true,
        serverId,
        newStatus: ServerStatus.WAKE_IN_PROGRESS,
        message: 'Wake-on-LAN packet sent successfully.',
      };
    }

    return {
      success: false,
      serverId,
      newStatus: server.properties?.status ?? ServerStatus.UNKNOWN,
      message: 'Failed to send Wake-on-LAN packet.',
    };
  }

  async handleStopServer(serverId: string, userId: string) {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      include: { properties: true },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    try {
      await firstValueFrom(
        this.multiVerseClient.send(
          'server.shutdown',
          new PowerServerEvent({ serverId }),
        ),
      );

      await this.prisma.serverProperties.update({
        where: { serverId },
        data: {
          stoppedBy: { connect: { id: userId } },
          status: ServerStatus.SHUTDOWN_IN_PROGRESS,
        },
      });

      return {
        success: true,
        serverId,
        newStatus: ServerStatus.SHUTDOWN_IN_PROGRESS,
        message: 'Shutdown command issued successfully.',
      };
    } catch (error) {
      return {
        success: false,
        serverId,
        newStatus: server.properties?.status ?? ServerStatus.UNKNOWN,
        message: 'Failed to issue shutdown command.',
      };
    }
  }

  async handleRebootServer(serverId: string, userId: string) {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      include: { properties: true },
    });

    if (!server) {
      throw new NotFoundException('Server not found');
    }

    try {
      await firstValueFrom(
        this.multiVerseClient.send(
          'server.reboot',
          new PowerServerEvent({ serverId }),
        ),
      );

      await this.prisma.serverProperties.update({
        where: { serverId },
        data: {
          stoppedBy: { connect: { id: userId } },
          status: ServerStatus.SHUTDOWN_IN_PROGRESS,
        },
      });

      return {
        success: true,
        serverId,
        newStatus: ServerStatus.SHUTDOWN_IN_PROGRESS,
        message: 'Shutdown command issued successfully.',
      };
    } catch (error) {
      return {
        success: false,
        serverId,
        newStatus: server.properties?.status ?? ServerStatus.UNKNOWN,
        message: 'Failed to issue shutdown command.',
      };
    }
  }

  async handleWakeOnLan(mac: string) {
    try {
      return await wake(mac);
    } catch (e) {
      throw new InternalServerErrorException('Failed to send WOL packet');
    }
  }
}

import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketGateway } from '../websocket/websocket.gateway';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HeartbeatDto } from './dto';

@Injectable()
export class ServerPowerService {
  constructor(
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

  @Cron(CronExpression.EVERY_10_SECONDS)
  async monitorServerStatuses() {
    const treshold = new Date(Date.now() - 15_000);

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
}

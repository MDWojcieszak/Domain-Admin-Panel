import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WebsocketGateway, WsRoom } from '../websocket/websocket.gateway';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConfigService } from '@nestjs/config';
import { createSocket } from 'dgram';
import { HeartbeatDto } from './dto';
import { createMagicPacket } from 'wol';
import { ServerStatus } from '@prisma/client';
import { PowerServerEvent } from './events';
import { ServerOutboundMessagingService } from '../server-outbound/server-outbound-messaging.service';

@Injectable()
export class ServerPowerService {
  constructor(
    private readonly outbound: ServerOutboundMessagingService,
    private prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly config: ConfigService,
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
      this.websocketGateway.emitToRoom(
        WsRoom.SERVERS,
        'server.offline',
        server.id,
      );
    });

    backOnlineServers.forEach((server) => {
      this.websocketGateway.emitToRoom(
        WsRoom.SERVERS,
        'server.online',
        server.id,
      );
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

    const wakeSent = await this.handleWakeOnLan(
      server.macAddress,
      server.ipAddress,
    );

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
      await this.outbound.sendToServer(
        server.name,
        'server.shutdown',
        new PowerServerEvent({ serverId }),
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
      await this.outbound.sendToServer(
        server.name,
        'server.reboot',
        new PowerServerEvent({ serverId }),
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

  /**
   * Sends the Wake-on-LAN magic packet. To maximise the chance it reaches the
   * target we send to several broadcast addresses (an explicit override, the
   * directed /24 broadcast derived from the server IP, and the limited
   * 255.255.255.255 broadcast) and repeat a few times. Each send binds the
   * socket and enables SO_BROADCAST *before* sending, avoiding the EACCES race
   * present in the `wol` package's own `wake()`.
   *
   * NOTE: WoL is layer-2. The backend host must share a broadcast domain with
   * the target (or a router must forward the directed broadcast). When the
   * backend runs in Docker, use host networking — bridged containers cannot
   * broadcast onto the physical LAN.
   */
  async handleWakeOnLan(mac: string, ipAddress?: string): Promise<boolean> {
    const port = Number(this.config.get('WOL_PORT')) || 9;
    const targets = this.buildBroadcastTargets(ipAddress);
    const REPEATS = 3;

    let anySent = false;
    for (const address of targets) {
      for (let i = 0; i < REPEATS; i++) {
        const ok = await this.sendMagicPacket(mac, address, port);
        anySent = anySent || ok;
      }
    }

    if (!anySent) {
      throw new InternalServerErrorException('Failed to send WOL packet');
    }
    Logger.log(`WOL packet sent for ${mac} to [${targets.join(', ')}]:${port}`);
    return true;
  }

  private buildBroadcastTargets(ipAddress?: string): string[] {
    const targets = new Set<string>();

    const configured = this.config.get<string>('WOL_BROADCAST_ADDRESS');
    if (configured) targets.add(configured);

    // Directed /24 broadcast derived from the target's IP (typical LAN setup).
    const match = ipAddress?.match(
      /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.\d{1,3}$/,
    );
    if (match) targets.add(`${match[1]}.${match[2]}.${match[3]}.255`);

    // Limited broadcast as a last-resort fallback.
    targets.add('255.255.255.255');

    return [...targets];
  }

  private sendMagicPacket(
    mac: string,
    address: string,
    port: number,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      let packet: Buffer;
      try {
        packet = createMagicPacket(mac);
      } catch (e) {
        Logger.error(`Invalid MAC for WOL "${mac}": ${(e as Error).message}`);
        return resolve(false);
      }

      const socket = createSocket('udp4');
      const done = (ok: boolean) => {
        try {
          socket.close();
        } catch {
          // socket already closed
        }
        resolve(ok);
      };

      socket.once('error', (err) => {
        Logger.error(`WOL socket error (${address}:${port}): ${err.message}`);
        done(false);
      });

      socket.bind(() => {
        socket.setBroadcast(true);
        socket.send(packet, 0, packet.length, port, address, (err) => {
          if (err) {
            Logger.error(
              `WOL send failed (${address}:${port}): ${err.message}`,
            );
            done(false);
          } else {
            done(true);
          }
        });
      });
    });
  }
}

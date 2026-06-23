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
import { ServerProcessStatus, ServerStatus } from '@prisma/client';
import { PowerServerEvent } from './events';
import { ServerOutboundMessagingService } from '../server-outbound/server-outbound-messaging.service';
import { NotificationService } from '../notification/notification.service';
import { PERMISSIONS } from '../common/acl/permissions';

/** Process statuses that mean "no longer running" — used for idle detection. */
const TERMINAL_PROCESS_STATUSES: ServerProcessStatus[] = [
  ServerProcessStatus.CLOSED,
  ServerProcessStatus.ENDED,
  ServerProcessStatus.FAILED,
];

type ServerNotifyKind = 'ONLINE' | 'OFFLINE_UNEXPECTED' | 'WAKE_FAILED';

const SERVER_NOTIFY_COPY: Record<
  ServerNotifyKind,
  { logType: string; headline: string; detail: string }
> = {
  ONLINE: {
    logType: 'SERVER_ONLINE',
    headline: 'is now online',
    detail: 'The server is reachable again and reporting heartbeats.',
  },
  OFFLINE_UNEXPECTED: {
    logType: 'SERVER_OFFLINE',
    headline: 'went offline unexpectedly',
    detail:
      'It stopped sending heartbeats without a planned shutdown — it may have crashed or lost connectivity.',
  },
  WAKE_FAILED: {
    logType: 'SERVER_WAKE_FAILED',
    headline: 'failed to wake',
    detail:
      'A Wake-on-LAN start was issued but the server did not come online within the timeout.',
  },
};

@Injectable()
export class ServerPowerService {
  /** A server is considered offline after this long without a heartbeat. */
  private readonly offlineThresholdMs: number;
  /** WAKE_IN_PROGRESS that never comes online within this window → ERROR. */
  private readonly wakeTimeoutMs: number;
  /** Online + no active process for this long → idle alert. */
  private readonly idleThresholdMs: number;

  constructor(
    private readonly outbound: ServerOutboundMessagingService,
    private prisma: PrismaService,
    private readonly websocketGateway: WebsocketGateway,
    private readonly config: ConfigService,
    private readonly notifications: NotificationService,
  ) {
    this.offlineThresholdMs =
      Number(this.config.get('SERVER_OFFLINE_THRESHOLD_MS')) || 10_000;
    this.wakeTimeoutMs =
      Number(this.config.get('SERVER_WAKE_TIMEOUT_MS')) || 120_000;
    this.idleThresholdMs =
      Number(this.config.get('SERVER_IDLE_THRESHOLD_MS')) || 1_800_000;
  }

  async handleHeartbeat(dto: HeartbeatDto) {
    try {
      const server = await this.prisma.server.findUnique({
        where: { name: dto.name },
        select: { id: true },
      });
      if (!server) throw new ForbiddenException();

      await this.markPresence(server.id);
      return true;
    } catch (error) {
      Logger.error(`Failed to handle heartbeat: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * First sign of life from a server (register OR heartbeat). Always refreshes
   * `lastSeenAt`; on the offline→online edge it flips the server ONLINE *right
   * away* and emits — no waiting for the monitor cron (kills the old up-to-5s
   * lag). Reconciles a stale WAKE_IN_PROGRESS into ONLINE in the same step.
   */
  async markPresence(serverId: string): Promise<void> {
    const props = await this.prisma.serverProperties.findUnique({
      where: { serverId },
      select: { isOnline: true, status: true, server: { select: { name: true } } },
    });
    if (!props) return;

    const now = new Date();
    const becameOnline = !props.isOnline || props.status !== ServerStatus.ONLINE;

    await this.prisma.serverProperties.update({
      where: { serverId },
      data: {
        lastSeenAt: now,
        isOnline: true,
        ...(becameOnline
          ? { status: ServerStatus.ONLINE, statusChangedAt: now }
          : {}),
      },
    });

    if (becameOnline) {
      this.websocketGateway.emitToRoom(WsRoom.SERVERS, 'server.online', serverId);
      this.emitStatus(serverId, ServerStatus.ONLINE, true, now);
      this.serverNotify('ONLINE', serverId, props.server.name);
    }
  }

  /**
   * Cron now drives only the two *negative* edges — going offline (stale
   * heartbeat) and wake timing out. The positive edge (coming online) is
   * event-driven via {@link markPresence}.
   */
  @Cron(CronExpression.EVERY_5_SECONDS)
  async monitorServerStatuses() {
    const ts = new Date();
    const offlineThreshold = new Date(ts.getTime() - this.offlineThresholdMs);
    const wakeDeadline = new Date(ts.getTime() - this.wakeTimeoutMs);

    // online → offline: was online, heartbeat went stale.
    const wentOffline = await this.prisma.serverProperties.findMany({
      where: { isOnline: true, lastSeenAt: { lt: offlineThreshold } },
      select: { serverId: true, status: true, server: { select: { name: true } } },
    });
    if (wentOffline.length) {
      const ids = wentOffline.map((s) => s.serverId);
      await this.prisma.serverProperties.updateMany({
        where: { serverId: { in: ids } },
        data: {
          isOnline: false,
          status: ServerStatus.OFFLINE,
          statusChangedAt: ts,
          idleSince: null,
          idleNotifiedAt: null,
        },
      });
      for (const s of wentOffline) {
        this.websocketGateway.emitToRoom(WsRoom.SERVERS, 'server.offline', s.serverId);
        this.emitStatus(s.serverId, ServerStatus.OFFLINE, false, ts);
        // Planned shutdown (SHUTDOWN_IN_PROGRESS) is expected → no alert.
        if (s.status !== ServerStatus.SHUTDOWN_IN_PROGRESS) {
          this.serverNotify('OFFLINE_UNEXPECTED', s.serverId, s.server.name);
        }
      }
    }

    // wake timed out: WAKE_IN_PROGRESS too long without ever coming online.
    const wakeFailed = await this.prisma.serverProperties.findMany({
      where: {
        status: ServerStatus.WAKE_IN_PROGRESS,
        isOnline: false,
        statusChangedAt: { lt: wakeDeadline },
      },
      select: { serverId: true, server: { select: { name: true } } },
    });
    if (wakeFailed.length) {
      const ids = wakeFailed.map((s) => s.serverId);
      await this.prisma.serverProperties.updateMany({
        where: { serverId: { in: ids } },
        data: { status: ServerStatus.ERROR, statusChangedAt: ts },
      });
      for (const s of wakeFailed) {
        this.emitStatus(s.serverId, ServerStatus.ERROR, false, ts);
        this.serverNotify('WAKE_FAILED', s.serverId, s.server.name);
      }
    }
  }

  /**
   * Idle detection: an ONLINE server with no active process for longer than
   * `idleThresholdMs` gets one email per idle period. `idleSince` tracks the
   * clock; `idleNotifiedAt` dedups. Both reset once a process runs (here) or the
   * server goes offline (in {@link monitorServerStatuses}).
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async monitorIdleServers() {
    const now = new Date();
    const servers = await this.prisma.serverProperties.findMany({
      where: { isOnline: true },
      select: {
        serverId: true,
        idleSince: true,
        idleNotifiedAt: true,
        server: { select: { name: true } },
      },
    });

    for (const s of servers) {
      const activeCount = await this.prisma.process.count({
        where: {
          category: { serverId: s.serverId },
          status: { notIn: TERMINAL_PROCESS_STATUSES },
        },
      });

      if (activeCount > 0) {
        if (s.idleSince || s.idleNotifiedAt) {
          await this.prisma.serverProperties.update({
            where: { serverId: s.serverId },
            data: { idleSince: null, idleNotifiedAt: null },
          });
        }
        continue;
      }

      if (!s.idleSince) {
        await this.prisma.serverProperties.update({
          where: { serverId: s.serverId },
          data: { idleSince: now },
        });
        continue;
      }

      const idleMs = now.getTime() - s.idleSince.getTime();
      if (idleMs >= this.idleThresholdMs && !s.idleNotifiedAt) {
        await this.prisma.serverProperties.update({
          where: { serverId: s.serverId },
          data: { idleNotifiedAt: now },
        });
        void this.notifications.emailUsers({
          setting: 'serverIdleEmailNotifications',
          permission: PERMISSIONS.SERVER_READ,
          logType: 'SERVER_IDLE',
          subject: `Server ${s.server.name} has been idle`,
          subjectName: s.server.name,
          headline: 'has been idle',
          detail:
            'It has been online with no active processes for a while — you may want to shut it down to save power.',
          meta: { serverId: s.serverId },
        });
      }
    }
  }

  /**
   * Canonical realtime status event — carries the full payload so the panel can
   * render progress (elapsed since `since`, wake timeout) without a refetch.
   * The legacy id-only `server.online`/`server.offline` events are still emitted
   * on those edges for backward compatibility.
   */
  private emitStatus(
    serverId: string,
    status: ServerStatus,
    isOnline: boolean,
    since: Date,
  ): void {
    this.websocketGateway.emitToRoom(WsRoom.SERVERS, 'server.status', {
      serverId,
      status,
      isOnline,
      since: since.toISOString(),
      wakeTimeoutMs: this.wakeTimeoutMs,
    });
  }

  /** Builds + dispatches a server-status email (gated by the user setting). */
  private serverNotify(
    kind: ServerNotifyKind,
    serverId: string,
    serverName: string,
  ): void {
    const copy = SERVER_NOTIFY_COPY[kind];
    void this.notifications.emailUsers({
      setting: 'serverStatusEmailNotifications',
      permission: PERMISSIONS.SERVER_READ,
      logType: copy.logType,
      subject: `Server ${serverName} ${copy.headline}`,
      subjectName: serverName,
      headline: copy.headline,
      detail: copy.detail,
      meta: { serverId },
    });
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
      const now = new Date();
      await this.prisma.serverProperties.update({
        where: { serverId },
        data: {
          startedBy: { connect: { id: userId } },
          startedAt: now,
          status: ServerStatus.WAKE_IN_PROGRESS,
          statusChangedAt: now,
        },
      });
      this.emitStatus(
        serverId,
        ServerStatus.WAKE_IN_PROGRESS,
        server.properties?.isOnline ?? false,
        now,
      );

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

      const now = new Date();
      await this.prisma.serverProperties.update({
        where: { serverId },
        data: {
          stoppedBy: { connect: { id: userId } },
          stoppedAt: now,
          status: ServerStatus.SHUTDOWN_IN_PROGRESS,
          statusChangedAt: now,
        },
      });
      this.emitStatus(
        serverId,
        ServerStatus.SHUTDOWN_IN_PROGRESS,
        server.properties?.isOnline ?? true,
        now,
      );

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

      const now = new Date();
      await this.prisma.serverProperties.update({
        where: { serverId },
        data: {
          stoppedBy: { connect: { id: userId } },
          stoppedAt: now,
          status: ServerStatus.SHUTDOWN_IN_PROGRESS,
          statusChangedAt: now,
        },
      });
      this.emitStatus(
        serverId,
        ServerStatus.SHUTDOWN_IN_PROGRESS,
        server.properties?.isOnline ?? true,
        now,
      );

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

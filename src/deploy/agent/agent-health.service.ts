import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

import { WebsocketGateway, WsRoom } from '../../websocket/websocket.gateway';

/**
 * Liveness of the deploy agent (§13.3).
 *
 * Without a heartbeat, a dead agent is indistinguishable from a quiet one: the
 * panel simply stops receiving events and keeps showing the last known state as
 * if it were current. This turns that silence into an explicit signal.
 */

/** Agent publishes every 30s; three missed beats mark it offline. */
const HEARTBEAT_INTERVAL_MS = 30_000;
const OFFLINE_AFTER_MS = HEARTBEAT_INTERVAL_MS * 3;

export interface AgentHeartbeat {
  version?: string;
  uptimeSeconds?: number;
  containerCount?: number;
  dockerReachable?: boolean;
}

export interface AgentHealth {
  online: boolean;
  lastSeenAt: Date | null;
  version: string | null;
  uptimeSeconds: number | null;
  containerCount: number | null;
  dockerReachable: boolean | null;
}

export type AgentOfflineHandler = () => Promise<void> | void;

@Injectable()
export class AgentHealthService {
  private readonly logger = new Logger(AgentHealthService.name);

  private lastSeenAt: Date | null = null;
  private online = false;
  private last: AgentHeartbeat = {};
  private readonly offlineHandlers: AgentOfflineHandler[] = [];
  private readonly onlineHandlers: AgentOfflineHandler[] = [];

  constructor(private readonly websocket: WebsocketGateway) {}

  /**
   * Registered by services that must react to the agent going away — clearing
   * the container view, marking runtime state unknown. Avoids a circular
   * dependency between this service and the ones it notifies.
   */
  onOffline(handler: AgentOfflineHandler): void {
    this.offlineHandlers.push(handler);
  }

  /**
   * Fires on the transition into online, not on every beat — the agent has just
   * appeared (or reappeared) and the backend's view of it is empty or stale.
   */
  onOnline(handler: AgentOfflineHandler): void {
    this.onlineHandlers.push(handler);
  }

  record(heartbeat: AgentHeartbeat): void {
    const wasOnline = this.online;

    this.lastSeenAt = new Date();
    this.online = true;
    this.last = heartbeat;

    if (!wasOnline) {
      this.logger.log(
        `Deploy agent online (version ${heartbeat.version ?? '?'})`,
      );
      this.emit();
      void this.run(this.onlineHandlers, 'online');
    }
  }

  health(): AgentHealth {
    return {
      online: this.online,
      lastSeenAt: this.lastSeenAt,
      version: this.last.version ?? null,
      uptimeSeconds: this.last.uptimeSeconds ?? null,
      containerCount: this.last.containerCount ?? null,
      dockerReachable: this.last.dockerReachable ?? null,
    };
  }

  @Interval(HEARTBEAT_INTERVAL_MS)
  async checkLiveness(): Promise<void> {
    if (!this.online || !this.lastSeenAt) return;

    const silentFor = Date.now() - this.lastSeenAt.getTime();
    if (silentFor < OFFLINE_AFTER_MS) return;

    this.online = false;
    this.logger.warn(
      `Deploy agent offline: no heartbeat for ${Math.round(silentFor / 1000)}s`,
    );

    this.emit();

    await this.run(this.offlineHandlers, 'offline');
  }

  /** One broken handler must not stop the others from doing their cleanup. */
  private async run(
    handlers: AgentOfflineHandler[],
    phase: string,
  ): Promise<void> {
    for (const handler of handlers) {
      try {
        await handler();
      } catch (error) {
        this.logger.error(
          `Agent ${phase} handler failed`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private emit(): void {
    this.websocket.emitToRoom(
      WsRoom.DEPLOYMENTS,
      'agent.health',
      this.health(),
    );
  }
}

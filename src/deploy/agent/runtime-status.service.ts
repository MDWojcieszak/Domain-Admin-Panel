import { Injectable, Logger } from '@nestjs/common';
import { CommandRuntimeStatus } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway, WsRoom } from '../../websocket/websocket.gateway';

/**
 * Keeps `Application.runtimeStatus` in step with what is actually running.
 *
 * D7 — this is the only writer of that column. The deployment path never
 * touches it: a release is a job that ends, while the service state outlives it
 * and is owned by the docker-events stream.
 */
@Injectable()
export class RuntimeStatusService {
  private readonly logger = new Logger(RuntimeStatusService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly websocket: WebsocketGateway,
  ) {}

  async apply(
    slug: string,
    runtimeStatus: CommandRuntimeStatus,
    message?: string,
  ): Promise<void> {
    const application = await this.prisma.application.findFirst({
      where: { slug, isDeleted: false },
      select: { id: true, runtimeStatus: true },
    });

    if (!application) {
      // A container can carry our label while its application row is gone —
      // after a delete, or before adoption finishes. Not an error.
      this.logger.debug(`Runtime update for unknown application "${slug}"`);
      return;
    }

    if (application.runtimeStatus === runtimeStatus) return;

    await this.prisma.application.update({
      where: { id: application.id },
      data: {
        runtimeStatus,
        runtimeSince: new Date(),
        runtimeMessage: message ?? null,
      },
    });

    this.websocket.emitToRoom(WsRoom.DEPLOYMENTS, 'application.runtime', {
      applicationId: application.id,
      slug,
      runtimeStatus,
      message: message ?? null,
      at: new Date().toISOString(),
    });
  }

  /**
   * Marks every application's runtime as unknown. Used when the agent goes
   * offline: a stale "running" read as current is worse than an explicit gap.
   */
  async markAllUnknown(): Promise<void> {
    const { count } = await this.prisma.application.updateMany({
      where: {
        isDeleted: false,
        runtimeStatus: { not: CommandRuntimeStatus.IDLE },
      },
      data: {
        runtimeStatus: CommandRuntimeStatus.IDLE,
        runtimeMessage: 'Agent offline — runtime state unknown',
        runtimeSince: new Date(),
      },
    });

    if (count > 0) {
      this.logger.warn(`Agent offline: ${count} application(s) marked unknown`);
      this.websocket.emitToRoom(
        WsRoom.DEPLOYMENTS,
        'application.runtime.stale',
        {
          count,
          at: new Date().toISOString(),
        },
      );
    }
  }
}

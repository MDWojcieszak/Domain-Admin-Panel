import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { ApplicationTier, ReleaseTrigger } from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway, WsRoom } from '../../websocket/websocket.gateway';
import { AgentHealthService } from '../agent/agent-health.service';
import { DeployAgentGateway } from '../agent/deploy-agent.gateway';
import { ContainerDiscoveryService } from '../discovery/container-discovery.service';
import { DeployNotificationService } from '../notifications/deploy-notification.service';
import { ReleaseService } from './release.service';

/**
 * Watches the registry for newer images of applications that opted in, and —
 * where asked — deploys them (§11.5).
 *
 * Mostly for third-party images such as Immich or Postgres: anything built from
 * our own code announces itself through the CI webhook instead, which is both
 * faster and free of registry round-trips.
 */

/**
 * Every six hours, not every few minutes.
 *
 * Each check is a registry request, and public registries rate-limit
 * aggressively by IP — a tight loop across a dozen applications would get the
 * whole host throttled, which would then break real deployments rather than
 * just this feature.
 */
const POLL_INTERVAL_MS = 6 * 60 * 60 * 1000;

/** Small gap between applications so a batch does not arrive as a burst. */
const STAGGER_MS = 2_000;

@Injectable()
export class UpdatePollerService {
  private readonly logger = new Logger(UpdatePollerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agent: DeployAgentGateway,
    private readonly health: AgentHealthService,
    private readonly discovery: ContainerDiscoveryService,
    private readonly releases: ReleaseService,
    private readonly notifications: DeployNotificationService,
    private readonly websocket: WebsocketGateway,
  ) {}

  @Interval(POLL_INTERVAL_MS)
  async poll(): Promise<void> {
    if (!this.health.health().online) {
      this.logger.debug('Skipping update poll: agent offline');
      return;
    }

    const applications = await this.prisma.application.findMany({
      where: { isDeleted: false, image: { not: null } },
      select: {
        id: true,
        slug: true,
        image: true,
        tier: true,
        spec: true,
        availableDigest: true,
        currentRelease: { select: { digest: true } },
      },
    });

    const watched = applications.filter(
      (app) => (app.spec as { pollForUpdates?: boolean })?.pollForUpdates,
    );

    for (const application of watched) {
      await this.checkOne(application);
      await this.pause();
    }
  }

  private async checkOne(application: {
    id: string;
    slug: string;
    image: string | null;
    tier: ApplicationTier;
    spec: unknown;
    availableDigest: string | null;
    currentRelease: { digest: string | null } | null;
  }): Promise<void> {
    const spec = (application.spec ?? {}) as {
      projectName?: string;
      autoUpdate?: boolean;
    };

    try {
      const stack = this.discovery.stack(spec.projectName ?? application.slug);
      const check = await this.agent.checkForUpdate(
        stack,
        application.image as string,
      );

      if (!check.available) return;

      const running = check.current ?? application.currentRelease?.digest;
      if (check.available === running) {
        // Back in step — clear a previously recorded update so the panel does
        // not keep showing a badge for something already deployed.
        if (application.availableDigest) {
          await this.clear(application.id);
        }
        return;
      }

      // Already reported; do not notify again every six hours.
      if (application.availableDigest === check.available) return;

      await this.record(application.id, application.slug, check.available);

      if (spec.autoUpdate) {
        await this.autoDeploy(application, check.available);
      }
    } catch (error) {
      // One unreachable registry must not stop the rest of the sweep.
      this.logger.warn(
        `Update check failed for "${application.slug}": ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private async record(
    applicationId: string,
    slug: string,
    digest: string,
  ): Promise<void> {
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { availableDigest: digest, lastPolledAt: new Date() },
    });

    this.websocket.emitToRoom(
      WsRoom.DEPLOYMENTS,
      'application.update-available',
      { applicationId, slug, digest },
    );

    void this.notifications.updateAvailable(slug, digest);
    this.logger.log(`Newer image available for "${slug}"`);
  }

  private async clear(applicationId: string): Promise<void> {
    await this.prisma.application.update({
      where: { id: applicationId },
      data: { availableDigest: null, lastPolledAt: new Date() },
    });
  }

  private async autoDeploy(
    application: { id: string; slug: string; tier: ApplicationTier },
    digest: string,
  ): Promise<void> {
    // Restarting the database or the broker because a new tag appeared is
    // exactly the surprise nobody wants at 3am. Infrastructure updates are
    // reported and left for a human to schedule.
    if (application.tier === ApplicationTier.INFRASTRUCTURE) {
      this.logger.log(
        `"${application.slug}" is infrastructure-tier; reporting the update ` +
          'instead of deploying it automatically.',
      );
      return;
    }

    try {
      await this.releases.create(application.id, {
        digest,
        trigger: ReleaseTrigger.AUTO_UPDATE,
      });
      this.logger.log(`Auto-updating "${application.slug}" to ${digest}`);
    } catch (error) {
      // A deployment already in flight (I13) is a normal outcome here, not a
      // failure: the next poll will pick it up if it is still needed.
      this.logger.warn(
        `Auto-update of "${application.slug}" did not start: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }
  }

  private pause(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, STAGGER_MS));
  }
}

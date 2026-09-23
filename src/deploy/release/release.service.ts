import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AppSourceType,
  ApplicationTier,
  Prisma,
  ReleaseStatus,
  ReleaseTrigger,
  ServerProcessStatus,
} from '@prisma/client';

import { PrismaService } from '../../prisma/prisma.service';
import { WebsocketGateway, WsRoom } from '../../websocket/websocket.gateway';
import { AuditService } from '../audit/audit.service';
import { DeployAgentGateway } from '../agent/deploy-agent.gateway';
import { DeployGitDto } from '../agent/events';
import { DeployResultDto } from '../dto';
import { DeployRenderService } from '../renderer/deploy-render.service';
import { DeployNotificationService } from '../notifications/deploy-notification.service';
import { LogRedactionService } from '../secrets/log-redaction.service';
import { parseAppSpec } from '../renderer/app-spec';

/**
 * Drives one deployment from approval to running, and owns every transition of
 * `Release.status` (docs/deploy-design.md §12).
 *
 * The rules that matter live here rather than in the controller, because the
 * same path is entered from the panel, a webhook, a schedule and an automatic
 * update — and each of them must be subject to the same guards.
 */

/**
 * What every entry point into a deployment provides. `CreateReleaseDto` (the
 * panel) satisfies it structurally; webhooks and the update poller build it
 * themselves and leave `composeHash` out, since nobody approved a diff.
 */
export interface ReleaseRequest {
  composeHash?: string;
  version?: string;
  digest?: string;
  trigger?: ReleaseTrigger;
}

/** Releases stuck this long without a result are declared unknown (§6.4). */
const STALE_AFTER_MS = 30 * 60 * 1000;

const HOMELAB_STACKS_ROOT = 'stacks';

@Injectable()
export class ReleaseService {
  private readonly logger = new Logger(ReleaseService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly render: DeployRenderService,
    private readonly agent: DeployAgentGateway,
    private readonly audit: AuditService,
    private readonly websocket: WebsocketGateway,
    private readonly redaction: LogRedactionService,
    private readonly notifications: DeployNotificationService,
  ) {}

  async create(
    applicationId: string,
    dto: ReleaseRequest,
    actorId?: string,
  ): Promise<{ releaseId: string; processId: string }> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, isDeleted: false },
      include: { currentRelease: true, gitRepo: true },
    });

    if (!application) throw new NotFoundException('Application not found');

    // I1 — the bootstrap tier updates itself through the agent's own path.
    if (application.tier === ApplicationTier.BOOTSTRAP) {
      throw new BadRequestException(
        'Bootstrap-tier applications cannot be deployed from the panel; ' +
          'they are updated through the agent self-update path (§6.6).',
      );
    }

    // I5 — the operator approved a specific rendering; re-render and compare.
    const preview = await this.render.renderForDeploy(applicationId);

    if (preview.missingKeys.length) {
      throw new BadRequestException(
        `Cannot deploy: undefined variables ${preview.missingKeys.join(', ')}.`,
      );
    }
    if (!preview.compose) {
      throw new BadRequestException('The application could not be rendered.');
    }

    // I5 guards a HUMAN approval: someone looked at a diff and said yes, so
    // deploying anything else would be deploying what nobody saw. An automatic
    // trigger has no such approval to protect — its intent is "whatever is
    // current" — so the hash is checked only for manual deployments.
    const trigger = dto.trigger ?? ReleaseTrigger.MANUAL;

    if (
      trigger === ReleaseTrigger.MANUAL &&
      preview.composeHash !== dto.composeHash
    ) {
      throw new ConflictException(
        'The rendered configuration changed since it was previewed. ' +
          'Review the new diff and approve it again.',
      );
    }

    const spec = parseAppSpec(application.spec);
    const { releaseId, processId } = await this.open(
      application,
      dto,
      preview.compose,
      preview.envKeys,
      actorId,
    );

    // Armed before the agent can emit a single line: a leaked secret would be
    // written to ProcessLog and pushed over the WebSocket in one step (I4).
    this.redaction.register(processId, preview.secretValues);

    try {
      await this.agent.sendDeploy({
        releaseId,
        processId,
        slug: application.slug,
        stackDirectory: `${HOMELAB_STACKS_ROOT}/${application.slug}`,
        buildMode: application.buildMode,
        compose: preview.compose,
        env: preview.env ?? '',
        spec,
        commitMessage: `deploy ${application.slug} ${
          dto.version ?? application.currentRelease?.version ?? ''
        }`.trim(),
        git: this.gitBlock(application),
      });
    } catch (error) {
      // The command never left, so nothing is in flight — free the lock at once
      // instead of leaving the application blocked until the TTL sweep.
      await this.fail(
        releaseId,
        error instanceof Error ? error.message : 'Could not reach the agent',
      );
      throw error;
    }

    await this.prisma.release.update({
      where: { id: releaseId },
      data: { status: ReleaseStatus.DEPLOYING },
    });

    this.emit(applicationId, releaseId, ReleaseStatus.DEPLOYING);

    await this.audit.record({
      actorId,
      action: 'release.deploy',
      entityType: 'Application',
      entityId: applicationId,
      entityName: application.slug,
      diff: {
        version: {
          from: application.currentRelease?.version ?? null,
          to: dto.version ?? null,
        },
      },
    });

    return { releaseId, processId };
  }

  /**
   * Applies the agent's verdict. Idempotent: a redelivered result for a release
   * that already settled is ignored rather than reopening it (§12.2).
   */
  async applyResult(dto: DeployResultDto): Promise<void> {
    const release = await this.prisma.release.findUnique({
      where: { id: dto.releaseId },
      select: {
        id: true,
        status: true,
        applicationId: true,
        processId: true,
      },
    });

    if (!release) {
      this.logger.warn(`Result for unknown release ${dto.releaseId}`);
      return;
    }

    if (release.status !== ReleaseStatus.DEPLOYING) {
      this.logger.log(
        `Ignoring result for release ${dto.releaseId}: already ${release.status}`,
      );
      return;
    }

    try {
      // I15 — a successful command is not a successful release. The health gate
      // decides, because `compose up` exiting 0 only means containers started.
      if (dto.success && dto.healthy) {
        await this.succeed(release.id, release.applicationId, dto);
        return;
      }

      await this.fail(
        release.id,
        dto.failureReason ??
          (dto.success
            ? 'Containers started but the health gate did not pass.'
            : 'The deployment command failed.'),
      );
    } finally {
      // The deployment is over, so the secrets are no longer needed. Kept out of
      // the early returns above on purpose: forgetting them is not optional.
      if (release.processId) this.redaction.forget(release.processId);
    }
  }

  async rollback(releaseId: string, actorId?: string) {
    const target = await this.prisma.release.findUnique({
      where: { id: releaseId },
      include: { application: true },
    });

    if (!target) throw new NotFoundException('Release not found');
    if (!target.renderedCompose) {
      throw new BadRequestException(
        'This release has no stored configuration, so it cannot be rolled back to. ' +
          'Adopted stacks have no first rendering.',
      );
    }

    // Rolling back reuses the stored bytes rather than re-rendering: the spec
    // may have changed since, and the point is to get back exactly what ran.
    const application = target.application;
    const spec = parseAppSpec(application.spec);

    const { releaseId: newReleaseId, processId } = await this.open(
      application,
      {
        composeHash: this.render.hash(target.renderedCompose),
        version: target.version ?? undefined,
        digest: target.digest ?? undefined,
        trigger: ReleaseTrigger.ROLLBACK,
      },
      target.renderedCompose,
      target.renderedEnvKeys,
      actorId,
      target.id,
    );

    const preview = await this.render.renderForDeploy(application.id);
    this.redaction.register(processId, preview.secretValues);

    await this.agent.sendDeploy({
      releaseId: newReleaseId,
      processId,
      slug: application.slug,
      stackDirectory: `${HOMELAB_STACKS_ROOT}/${application.slug}`,
      buildMode: application.buildMode,
      compose: target.renderedCompose,
      env: preview.env ?? '',
      spec,
      commitMessage: `rollback ${application.slug} to ${target.version ?? target.id}`,
    });

    await this.prisma.release.update({
      where: { id: newReleaseId },
      data: { status: ReleaseStatus.DEPLOYING },
    });

    await this.audit.record({
      actorId,
      action: 'release.rollback',
      entityType: 'Application',
      entityId: application.id,
      entityName: application.slug,
      diff: { rolledBackTo: { from: null, to: target.id } },
    });

    return { releaseId: newReleaseId, processId };
  }

  /**
   * Releases that never reported a result. Marked UNKNOWN, not FAILED — the
   * deployment may well have succeeded; what is missing is the report (§6.4).
   */
  async sweepStale(): Promise<number> {
    const cutoff = new Date(Date.now() - STALE_AFTER_MS);

    const stale = await this.prisma.release.findMany({
      where: {
        status: { in: [ReleaseStatus.PENDING, ReleaseStatus.DEPLOYING] },
        createdAt: { lt: cutoff },
      },
      select: { id: true, applicationId: true },
    });

    for (const release of stale) {
      await this.prisma.release.update({
        where: { id: release.id },
        data: {
          status: ReleaseStatus.UNKNOWN,
          failureReason:
            'No result arrived within the deployment timeout; the outcome is unknown.',
        },
      });
      this.emit(release.applicationId, release.id, ReleaseStatus.UNKNOWN);
    }

    if (stale.length) {
      this.logger.warn(`${stale.length} release(s) timed out without a result`);
    }

    return stale.length;
  }

  /**
   * Creates the process and the release together.
   *
   * The process row is made here rather than by the agent registering one: it
   * removes a round-trip, guarantees the release↔process link, and lets the
   * deploy command carry everything the agent needs (I7).
   */
  private async open(
    application: { id: string; slug: string; serverCategoryId: string },
    dto: ReleaseRequest,
    compose: string,
    envKeys: string[],
    actorId?: string,
    previousReleaseId?: string,
  ): Promise<{ releaseId: string; processId: string }> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const process = await tx.process.create({
          data: {
            name: `deploy ${application.slug}`,
            status: ServerProcessStatus.STARTED,
            progress: 0,
            categoryId: application.serverCategoryId,
            startedById: actorId as string,
          },
        });

        const release = await tx.release.create({
          data: {
            applicationId: application.id,
            version: dto.version ?? null,
            digest: dto.digest ?? null,
            status: ReleaseStatus.PENDING,
            processId: process.id,
            renderedCompose: compose,
            renderedEnvKeys: envKeys,
            previousReleaseId: previousReleaseId ?? null,
            triggeredById: actorId ?? null,
            trigger: dto.trigger ?? ReleaseTrigger.MANUAL,
          },
        });

        return { releaseId: release.id, processId: process.id };
      });
    } catch (error) {
      // I13 — the partial unique index refuses a second in-flight release. This
      // is the guard against a panel click, a webhook and an auto-update landing
      // in the same second.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Another deployment of this application is already in progress.',
        );
      }
      throw error;
    }
  }

  private async succeed(
    releaseId: string,
    applicationId: string,
    dto: DeployResultDto,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // I2 — at most one ACTIVE release per application, enforced in the same
      // transaction that promotes the new one.
      await tx.release.updateMany({
        where: {
          applicationId,
          status: ReleaseStatus.ACTIVE,
          id: { not: releaseId },
        },
        data: { status: ReleaseStatus.SUPERSEDED },
      });

      await tx.release.update({
        where: { id: releaseId },
        data: {
          status: ReleaseStatus.ACTIVE,
          deployedAt: new Date(),
          digest: dto.digest ?? undefined,
          homelabCommit: dto.homelabCommit ?? undefined,
          failureReason: null,
        },
      });

      await tx.application.update({
        where: { id: applicationId },
        data: { currentReleaseId: releaseId },
      });
    });

    this.emit(applicationId, releaseId, ReleaseStatus.ACTIVE);
    this.logger.log(`Release ${releaseId} is active`);
  }

  private async fail(releaseId: string, reason: string): Promise<void> {
    const release = await this.prisma.release.update({
      where: { id: releaseId },
      data: { status: ReleaseStatus.FAILED, failureReason: reason },
      select: {
        applicationId: true,
        version: true,
        application: { select: { slug: true } },
      },
    });

    this.emit(release.applicationId, releaseId, ReleaseStatus.FAILED, reason);
    this.logger.warn(`Release ${releaseId} failed: ${reason}`);

    // Deliberately not awaited: this runs inside a manual-ack RMQ handler, and
    // a hanging SMTP server would delay the ack until the broker redelivers.
    void this.notifications.releaseFailed(
      release.application.slug,
      release.version,
      reason,
    );
  }

  /**
   * Repository details for a GIT-sourced application. Carries no credentials —
   * the agent asks for those separately at clone time, so a token never sits in
   * the durable deploy queue (I8, §8.2).
   */
  private gitBlock(application: {
    sourceType: AppSourceType;
    slug: string;
    gitRepo: {
      id: string;
      repo: string;
      branch: string;
      clonePath: string | null;
    } | null;
  }): DeployGitDto | null {
    if (application.sourceType !== AppSourceType.GIT) return null;

    if (!application.gitRepo) {
      throw new BadRequestException(
        `Application "${application.slug}" has sourceType GIT but no repository ` +
          'is attached.',
      );
    }

    const repo = application.gitRepo;

    return new DeployGitDto(
      repo.id,
      repo.repo,
      'github.com',
      repo.branch,
      repo.clonePath ?? `/mnt/VAULT/APPS/repos/${repo.repo}`,
      false,
    );
  }

  private emit(
    applicationId: string,
    releaseId: string,
    status: ReleaseStatus,
    failureReason?: string,
  ): void {
    this.websocket.emitToRoom(WsRoom.DEPLOYMENTS, 'release.status', {
      applicationId,
      releaseId,
      status,
      failureReason: failureReason ?? null,
      at: new Date().toISOString(),
    });
  }
}

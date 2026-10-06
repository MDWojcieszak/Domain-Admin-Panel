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
  /** GIT applications: commit sha or tag; absent follows the branch head. */
  ref?: string;
  /**
   * Who or what started it, in words, when no user did — e.g. the CI run
   * behind a webhook. Falls back to the trigger's own name.
   */
  triggeredByLabel?: string;
}

/**
 * What the panel shows as "started by" for a deployment with no user behind
 * it. A user-started one shows the user and stores no label.
 */
const TRIGGER_LABEL: Record<ReleaseTrigger, string> = {
  MANUAL: 'panel',
  WEBHOOK: 'webhook',
  SCHEDULE: 'schedule',
  AUTO_UPDATE: 'automatic update',
  ROLLBACK: 'rollback',
  AUTO_ROLLBACK: 'automatic rollback',
};

/** Releases stuck this long without a result are declared unknown (§6.4). */
const STALE_AFTER_MS = 30 * 60 * 1000;

const HOMELAB_STACKS_ROOT = 'stacks';

/** Where clones live on the host when a repository names no path. */
const DEFAULT_CLONE_ROOT = '/mnt/VAULT/APPS/repos';

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

    if (dto.ref && application.sourceType !== AppSourceType.GIT) {
      throw new BadRequestException(
        'A commit or tag can only be chosen for an application deployed from git.',
      );
    }

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

    const spec = this.withProjectName(
      parseAppSpec(application.spec),
      application.slug,
    );
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
          dto.ref ?? dto.version ?? application.currentRelease?.version ?? ''
        }`.trim(),
        git: this.gitBlock(application, dto.ref),
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
        ...(dto.ref
          ? {
              commit: {
                from: application.currentRelease?.commit ?? null,
                to: dto.ref,
              },
            }
          : {}),
      },
    });

    return { releaseId, processId };
  }

  /**
   * Stops a release that has not finished: it never reached the agent, the
   * agent is stuck on it, or the operator simply changed their mind.
   *
   * Two steps, because the agent may still be working: killing a compose step,
   * cloning, waiting out a health gate, or not yet aware of the cancel at all.
   * The release goes to CANCELLING, which still holds the application (I13), so
   * no second deployment of the same stack can start beside the first. It
   * becomes CANCELLED when the agent reports how it stopped — or, if the agent
   * stays silent, when sweepStale gives up on it.
   *
   * The secrets stay armed for redaction until then: the agent keeps writing
   * log lines until it has actually stopped.
   */
  async cancel(releaseId: string, actorId?: string): Promise<void> {
    const release = await this.prisma.release.findUnique({
      where: { id: releaseId },
      select: {
        id: true,
        status: true,
        applicationId: true,
        processId: true,
        application: { select: { slug: true } },
      },
    });
    if (!release) throw new NotFoundException('Release not found');

    const running: ReleaseStatus[] = [
      ReleaseStatus.PENDING,
      ReleaseStatus.DEPLOYING,
      ReleaseStatus.DEFERRED,
    ];
    if (release.status === ReleaseStatus.CANCELLING) {
      throw new ConflictException(
        'This release is already being cancelled; waiting for the agent to stop it.',
      );
    }
    if (!running.includes(release.status)) {
      throw new ConflictException(
        `Release is already ${release.status.toLowerCase()}; there is nothing to cancel.`,
      );
    }

    const reason = 'Cancel requested from the panel; waiting for the agent.';
    await this.prisma.release.update({
      where: { id: releaseId },
      data: { status: ReleaseStatus.CANCELLING, failureReason: reason },
    });

    this.emit(
      release.applicationId,
      releaseId,
      ReleaseStatus.CANCELLING,
      reason,
    );

    try {
      await this.agent.cancelDeploy(releaseId);
    } catch (error) {
      // The release stays CANCELLING: the agent stops it when the message gets
      // through, and sweepStale settles it if it never does.
      this.logger.warn(
        `Could not tell the agent to cancel ${releaseId}: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
    }

    await this.audit.record({
      actorId,
      action: 'release.cancel',
      entityType: 'Application',
      entityId: release.applicationId,
      entityName: release.application.slug,
      diff: { status: { from: release.status, to: ReleaseStatus.CANCELLING } },
    });
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

    if (
      release.status !== ReleaseStatus.DEPLOYING &&
      release.status !== ReleaseStatus.CANCELLING
    ) {
      this.logger.log(
        `Ignoring result for release ${dto.releaseId}: already ${release.status}`,
      );
      return;
    }

    try {
      // I15 — a successful command is not a successful release. The health gate
      // decides, because `compose up` exiting 0 only means containers started.
      if (dto.success && dto.healthy) {
        // Also when it was being cancelled: the cancel arrived too late and the
        // new release is what runs now. Recording it as cancelled would leave
        // the panel describing containers that are not there.
        if (release.status === ReleaseStatus.CANCELLING) {
          this.logger.warn(
            `Release ${release.id} finished before the cancel reached it`,
          );
        }
        await this.succeed(release.id, release.applicationId, dto);
        return;
      }

      if (release.status === ReleaseStatus.CANCELLING) {
        await this.settleCancelled(release, dto.failureReason);
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
      include: { application: { include: { gitRepo: true } } },
    });

    if (!target) throw new NotFoundException('Release not found');
    if (!target.renderedCompose) {
      throw new BadRequestException(
        'This release has no stored configuration, so it cannot be rolled back to. ' +
          'Adopted stacks have no first rendering.',
      );
    }

    // Without the sha the agent would follow the branch head, so the "rollback"
    // would ship the newest code under an old compose file — worse than refusing.
    if (target.application.sourceType === AppSourceType.GIT && !target.commit) {
      throw new BadRequestException(
        'This release did not record which commit it ran, so it cannot be ' +
          'rolled back to. Deploy the commit or tag you want instead.',
      );
    }

    // Rolling back reuses the stored bytes rather than re-rendering: the spec
    // may have changed since, and the point is to get back exactly what ran.
    const application = target.application;
    const spec = this.withProjectName(
      parseAppSpec(application.spec),
      application.slug,
    );

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
      commitMessage: `rollback ${application.slug} to ${
        target.commit?.slice(0, 7) ?? target.version ?? target.id
      }`,
      git: this.gitBlock(application, target.commit),
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
        status: {
          in: [
            ReleaseStatus.PENDING,
            ReleaseStatus.DEPLOYING,
            ReleaseStatus.CANCELLING,
          ],
        },
        createdAt: { lt: cutoff },
      },
      select: { id: true, applicationId: true, status: true, processId: true },
    });

    for (const release of stale) {
      // A cancel the agent never confirmed is UNKNOWN too, not CANCELLED: the
      // deployment may have run to the end before the message got through.
      const failureReason =
        release.status === ReleaseStatus.CANCELLING
          ? 'Cancel was requested, but the agent never confirmed it stopped; the outcome is unknown.'
          : 'No result arrived within the deployment timeout; the outcome is unknown.';

      await this.prisma.release.update({
        where: { id: release.id },
        data: { status: ReleaseStatus.UNKNOWN, failureReason },
      });
      if (release.processId) this.redaction.forget(release.processId);
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
    application: { id: string; slug: string },
    dto: ReleaseRequest,
    compose: string,
    envKeys: string[],
    actorId?: string,
    previousReleaseId?: string,
  ): Promise<{ releaseId: string; processId: string }> {
    const trigger = dto.trigger ?? ReleaseTrigger.MANUAL;
    // A user is recorded as a user; anything else as words, never as a
    // made-up account — that would show up in permissions and the audit trail.
    const label = actorId
      ? null
      : (dto.triggeredByLabel ?? TRIGGER_LABEL[trigger]);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const process = await tx.process.create({
          data: {
            name: `deploy ${application.slug}`,
            status: ServerProcessStatus.STARTED,
            progress: 0,
            startedById: actorId ?? null,
            startedByLabel: label,
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
            triggeredByLabel: label,
            trigger,
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
          commit: dto.commit ?? undefined,
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

  /**
   * The agent has stopped a release that was being cancelled. Only now is the
   * application free again: CANCELLED is outside the in-flight index (I13).
   *
   * Not a failure notification — the operator asked for this. The agent's own
   * reason is kept, because a cancel in the middle of `up` leaves a stack that
   * is partly the new release, and that is worth knowing.
   */
  private async settleCancelled(
    release: { id: string; applicationId: string; processId: string | null },
    agentReason?: string | null,
  ): Promise<void> {
    const reason = agentReason
      ? `Cancelled from the panel. The agent stopped at: ${agentReason}`
      : 'Cancelled from the panel.';

    await this.prisma.release.update({
      where: { id: release.id },
      data: { status: ReleaseStatus.CANCELLED, failureReason: reason },
    });
    if (release.processId) {
      await this.prisma.process.update({
        where: { id: release.processId },
        data: { status: ServerProcessStatus.FAILED },
      });
    }

    this.emit(
      release.applicationId,
      release.id,
      ReleaseStatus.CANCELLED,
      reason,
    );
    this.logger.log(`Release ${release.id} cancelled`);
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
  /**
   * The git half of a deploy command.
   *
   * The clone is per APPLICATION, not per repository: two applications built
   * from one repository (v1 and v2) follow different refs, and sharing a
   * working tree would have each deployment check out the other's code. The
   * followed ref is the application's own; `ref` pins one release to an exact
   * commit or tag on top of it.
   */
  private gitBlock(
    application: {
      sourceType: AppSourceType;
      slug: string;
      gitRef: string | null;
      compose: string | null;
      gitRepo: {
        id: string;
        repo: string;
        branch: string;
        clonePath: string | null;
      } | null;
    },
    ref?: string | null,
  ): DeployGitDto | null {
    if (application.sourceType !== AppSourceType.GIT) return null;

    if (!application.gitRepo) {
      throw new BadRequestException(
        `Application "${application.slug}" has sourceType GIT but no repository ` +
          'is attached.',
      );
    }

    const repo = application.gitRepo;
    const base = repo.clonePath ?? `${DEFAULT_CLONE_ROOT}/${repo.repo}`;

    return new DeployGitDto(
      repo.id,
      repo.repo,
      'github.com',
      application.gitRef ?? repo.branch,
      `${base}@${application.slug}`,
      false,
      ref ?? null,
      // A compose file kept in the panel wins over the repository's own.
      !application.compose,
    );
  }

  /**
   * Compose names a project after its directory unless told otherwise, and a
   * clone directory is not the application. Two applications from one
   * repository would share a project name — and the second deployment would
   * replace the first one's containers. The slug is pinned unless the spec
   * keeps an adopted stack's own name (I10).
   */
  private withProjectName(
    spec: ReturnType<typeof parseAppSpec>,
    slug: string,
  ): ReturnType<typeof parseAppSpec> {
    return spec.projectName ? spec : { ...spec, projectName: slug };
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

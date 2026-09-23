import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { AuditSource, ReleaseTrigger } from '@prisma/client';
import { randomBytes, timingSafeEqual } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DeployWebhookDto } from '../dto';
import { ReleaseService } from '../release/release.service';
import { SecretCryptoService } from '../secrets/secret-crypto.service';

/**
 * Lets a CI pipeline start a deployment once it has pushed an image (§15).
 *
 * Authenticated by a per-application secret rather than a user token: CI is not
 * a person, and a leaked secret should cost exactly one application rather than
 * everything that account can reach.
 */
@Injectable()
export class DeployWebhookService {
  private readonly logger = new Logger(DeployWebhookService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly releases: ReleaseService,
    private readonly crypto: SecretCryptoService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Generates a new secret and returns it **once**. It is stored encrypted, so
   * there is no way to read it back — a lost secret is rotated, not recovered.
   */
  async rotateSecret(applicationId: string, actorId?: string): Promise<string> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, isDeleted: false },
      select: { id: true, slug: true, webhookSecret: true },
    });

    if (!application) throw new NotFoundException('Application not found');

    const secret = randomBytes(32).toString('hex');

    await this.prisma.application.update({
      where: { id: applicationId },
      data: {
        webhookSecret: this.crypto.encrypt(secret),
        webhookEnabled: true,
      },
    });

    await this.audit.record({
      actorId,
      action: application.webhookSecret
        ? 'application.webhook.rotate'
        : 'application.webhook.enable',
      entityType: 'Application',
      entityId: applicationId,
      entityName: application.slug,
      diff: { webhookSecret: { from: '***', to: '***', changed: true } },
    });

    return secret;
  }

  async disable(applicationId: string, actorId?: string): Promise<void> {
    const application = await this.prisma.application.findFirst({
      where: { id: applicationId, isDeleted: false },
      select: { id: true, slug: true },
    });

    if (!application) throw new NotFoundException('Application not found');

    await this.prisma.application.update({
      where: { id: applicationId },
      data: { webhookEnabled: false, webhookSecret: null },
    });

    await this.audit.record({
      actorId,
      action: 'application.webhook.disable',
      entityType: 'Application',
      entityId: applicationId,
      entityName: application.slug,
    });
  }

  async handle(
    slug: string,
    presented: string | undefined,
    dto: DeployWebhookDto,
  ) {
    const application = await this.prisma.application.findFirst({
      where: { slug, isDeleted: false },
      select: {
        id: true,
        slug: true,
        webhookEnabled: true,
        webhookSecret: true,
      },
    });

    // Same error whether the application is missing, has no webhook, or the
    // secret is wrong: a probe must not learn which applications exist.
    if (
      !application ||
      !application.webhookEnabled ||
      !application.webhookSecret ||
      !this.matches(application.webhookSecret, presented)
    ) {
      this.logger.warn(`Rejected webhook for "${slug}"`);
      throw new UnauthorizedException('Invalid webhook credentials');
    }

    if (!dto.version && !dto.digest) {
      throw new BadRequestException(
        'Provide at least a version or a digest so the release can be identified.',
      );
    }

    await this.audit.record({
      source: AuditSource.WEBHOOK,
      action: 'release.webhook',
      entityType: 'Application',
      entityId: application.id,
      entityName: application.slug,
      diff: {
        version: { from: null, to: dto.version ?? null },
        digest: { from: null, to: dto.digest ?? null },
      },
    });

    // No composeHash: nobody approved a diff here. The guards that still apply
    // are the ones that do not need a human — rendering must succeed, every
    // variable must resolve, and only one deployment may be in flight.
    return this.releases.create(application.id, {
      version: dto.version,
      digest: dto.digest,
      trigger: ReleaseTrigger.WEBHOOK,
    });
  }

  /**
   * Constant-time comparison. A plain `===` leaks the secret one character at a
   * time to anyone who can measure response latency across many attempts.
   */
  private matches(stored: string, presented: string | undefined): boolean {
    if (!presented) return false;

    let expected: string;
    try {
      expected = this.crypto.decrypt(stored);
    } catch {
      return false;
    }

    const a = Buffer.from(expected, 'utf8');
    const b = Buffer.from(presented, 'utf8');

    // timingSafeEqual throws on a length mismatch, which would itself be a
    // timing signal; compare lengths separately and always run the check.
    if (a.length !== b.length) return false;

    return timingSafeEqual(a, b);
  }
}

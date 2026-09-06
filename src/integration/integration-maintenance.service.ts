import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../prisma/prisma.service';

const DAY_MS = 86_400_000;

/**
 * Kept past `expiresAt` so a failed authorization is still inspectable for a
 * day ("why did the app not connect this morning?"). Long enough to debug,
 * short enough that the table stays small.
 */
const RETENTION_MS = DAY_MS;

/**
 * Prunes finished device-authorization handshakes.
 *
 * Every abandoned "Authorize" — browser closed, code left to expire — leaves a
 * PENDING row behind, and nothing else ever deletes it. Left alone the table
 * grows without bound and slowly eats into the deliberately small user-code
 * space, making collisions (and retries in `generateUserCode`) more likely.
 *
 * Safe for any status: `IntegrationToken` rows are independent, and the FK from
 * a handshake to its issued token is `ON DELETE SET NULL` in that direction
 * only — deleting the handshake never touches a live token.
 */
@Injectable()
export class IntegrationMaintenanceService {
  private readonly logger = new Logger(IntegrationMaintenanceService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyMaintenance(): Promise<void> {
    await this.run();
  }

  /** Idempotent and safe to re-run. Callable for tests/admin. */
  async run(): Promise<{ deleted: number }> {
    const cutoff = new Date(Date.now() - RETENTION_MS);

    const { count } = await this.prisma.deviceAuthorization.deleteMany({
      where: { expiresAt: { lt: cutoff } },
    });

    if (count > 0) {
      this.logger.log(`Pruned ${count} expired device authorization(s)`);
    }

    return { deleted: count };
  }
}

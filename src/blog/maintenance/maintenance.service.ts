import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 86_400_000;

/**
 * Daily blog upkeep: reconcile denormalized engagement counters against their
 * source rows (repairs any drift) and prune old view logs. `viewCount` is the
 * authoritative denormalized value and is deliberately NOT recomputed — it must
 * survive view-log pruning. Idempotent and safe to re-run.
 */
@Injectable()
export class MaintenanceService {
  private readonly logger = new Logger(MaintenanceService.name);
  private readonly retentionDays: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.retentionDays = Math.max(
      1,
      Number(config.get('BLOG_VIEW_RETENTION_DAYS')) || 90,
    );
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyMaintenance(): Promise<void> {
    await this.run();
  }

  /** Reconcile like/feedback counters + prune old views. Callable for tests/admin. */
  async run(): Promise<{ reconciled: number; viewsDeleted: number }> {
    // Exact recompute from rows. viewCount intentionally untouched (denormalized,
    // survives pruning). SET (not increment) => idempotent.
    const reconciled = await this.prisma.$executeRaw`
      UPDATE "BlogPost" p SET
        "likeCount" = (SELECT count(*) FROM "BlogPostLike" l WHERE l."postId" = p.id),
        "helpfulCount" = (SELECT count(*) FROM "BlogPostFeedback" f WHERE f."postId" = p.id AND f."rating" = 'HELPFUL'),
        "notHelpfulCount" = (SELECT count(*) FROM "BlogPostFeedback" f WHERE f."postId" = p.id AND f."rating" = 'NOT_HELPFUL')
    `;

    const cutoff = new Date(Date.now() - this.retentionDays * DAY_MS);
    const viewsDeleted = await this.prisma.$executeRaw`
      DELETE FROM "BlogPostView" WHERE "createdAt" < ${cutoff}
    `;

    this.logger.log(
      `Blog maintenance: reconciled ${reconciled} posts, pruned ${viewsDeleted} views (retention ${this.retentionDays}d)`,
    );
    return { reconciled, viewsDeleted };
  }
}

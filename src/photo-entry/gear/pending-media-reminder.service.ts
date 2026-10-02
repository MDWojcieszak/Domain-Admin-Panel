import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PhotoEntryStatus } from '@prisma/client';

import { NotificationService } from '../../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { assessRow, ReminderLine, reminderCopy } from './pending-media';

/**
 * Daily nudge about media that is still on a card, a roll or a capture laptop
 * past its source's threshold (docs/photo-entry-redesign.md §6).
 *
 * One digest per user per run, repeated every threshold period until secured.
 * Only DECLARED gear is reminded about: an undeclared entry is unknown, and
 * mailing about every pre-redesign entry would bury the real warnings.
 */
@Injectable()
export class PendingMediaReminderService {
  private readonly logger = new Logger(PendingMediaReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_9AM)
  async runDaily(): Promise<void> {
    try {
      const sent = await this.remind();
      if (sent > 0) this.logger.log(`Sent ${sent} unsecured-media reminder(s)`);
    } catch (err) {
      this.logger.error(
        `Unsecured-media reminder run failed: ${(err as Error).message}`,
      );
    }
  }

  /** Returns the number of digests sent. */
  async remind(now: Date = new Date()): Promise<number> {
    const entries = await this.prisma.photoEntry.findMany({
      where: {
        status: PhotoEntryStatus.SHOT,
        gearConfirmedAt: { not: null },
        gear: { some: { used: true, secured: false } },
      },
      include: {
        gear: {
          where: { used: true, secured: false },
          include: { gearItem: true },
        },
      },
    });

    const byUser = new Map<
      string,
      { rowIds: string[]; lines: ReminderLine[] }
    >();
    for (const entry of entries) {
      for (const row of entry.gear) {
        const a = assessRow(
          entry,
          { ...row, category: row.gearItem.category },
          now,
        );
        if (!a?.remindDue) continue;

        const bucket = byUser.get(entry.userId) ?? { rowIds: [], lines: [] };
        bucket.rowIds.push(row.id);
        bucket.lines.push({
          entryName: entry.name,
          gearName: `${row.gearItem.brand} ${row.gearItem.model}`,
          secureAction: a.secureAction,
          daysPending: a.daysPending,
        });
        byUser.set(entry.userId, bucket);
      }
    }

    let sent = 0;
    for (const [userId, { rowIds, lines }] of byUser) {
      const delivered = await this.notifications.emailUser(userId, {
        setting: 'photoMediaEmailNotifications',
        logType: 'PHOTO_MEDIA_UNSECURED',
        ...reminderCopy(lines),
        meta: { gearRowIds: rowIds },
      });
      // Stamp only what was delivered: a failed or opted-out send is retried
      // on the next run rather than silently counted as a reminder.
      if (!delivered) continue;
      await this.prisma.photoEntryGear.updateMany({
        where: { id: { in: rowIds } },
        data: { remindedAt: now },
      });
      sent++;
    }
    return sent;
  }
}

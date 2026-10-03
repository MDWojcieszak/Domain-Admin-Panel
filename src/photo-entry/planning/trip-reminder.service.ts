import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { GearOwnership, PhotoEntryStatus } from '@prisma/client';

import { NotificationService } from '../../notification/notification.service';
import { forecastLine } from '../forecast/forecast';
import { ForecastService } from '../forecast/forecast.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  daysUntil,
  dueMilestone,
  reminderKey,
  TripReminderKind,
  TripReminderLine,
  tripReminderCopy,
} from './trip-reminders';

const LOG_TYPE = 'PHOTO_TRIP_REMINDER';
/** Widest milestone; entries further out are not even loaded. */
const HORIZON_DAYS = 31;

interface SentItem {
  entryId: string;
  kind: TripReminderKind;
  milestone: number;
}

/**
 * Daily pre-trip digest (docs/photo-entry-planning-and-publish.md §7): wishlist
 * gear still to buy at T-30 and T-7, unpacked gear at T-1. Each milestone goes
 * out once per entry (Q7) — deduplicated against NotificationLog, so no new
 * table is needed.
 */
@Injectable()
export class TripReminderService {
  private readonly logger = new Logger(TripReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly forecast: ForecastService,
  ) {}

  @Cron('5 9 * * *')
  async runDaily(): Promise<void> {
    try {
      const sent = await this.remind();
      if (sent > 0) this.logger.log(`Sent ${sent} pre-trip reminder(s)`);
    } catch (err) {
      this.logger.error(
        `Pre-trip reminder run failed: ${(err as Error).message}`,
      );
    }
  }

  /** Returns the number of digests sent. */
  async remind(now: Date = new Date()): Promise<number> {
    const horizon = new Date(now.getTime() + HORIZON_DAYS * 864e5);
    const yesterday = new Date(now.getTime() - 864e5);
    const entries = await this.prisma.photoEntry.findMany({
      where: {
        status: PhotoEntryStatus.PLANNED,
        startDate: { gte: yesterday, lte: horizon },
      },
      include: { gear: { include: { gearItem: true } }, location: true },
    });

    const byUser = new Map<
      string,
      { lines: TripReminderLine[]; items: SentItem[] }
    >();
    const alreadySent = await this.sentKeys(entries.map((e) => e.userId));

    for (const entry of entries) {
      const days = daysUntil(entry.startDate!, now);
      const bucket = byUser.get(entry.userId) ?? { lines: [], items: [] };

      const toBuy = entry.gear.filter(
        (r) => r.gearItem.ownership === GearOwnership.WISHLIST,
      );
      const owned = entry.gear.filter(
        (r) => r.gearItem.ownership === GearOwnership.OWNED,
      );
      const unpacked = owned.filter((r) => !r.packed);

      const candidates: Array<
        [TripReminderKind, boolean, () => TripReminderLine]
      > = [
        [
          TripReminderKind.SHOPPING,
          toBuy.length > 0,
          () => ({
            entryName: entry.name,
            days,
            kind: TripReminderKind.SHOPPING,
            items: toBuy.map((r) => nameOf(r.gearItem)),
            total: toBuy.reduce(
              (s, r) => s + (r.gearItem.estimatedPrice ?? 0),
              0,
            ),
          }),
        ],
        [
          TripReminderKind.PACKING,
          unpacked.length > 0,
          () => ({
            entryName: entry.name,
            days,
            kind: TripReminderKind.PACKING,
            items: unpacked.map((r) => nameOf(r.gearItem)),
            packed: owned.length - unpacked.length,
            of: owned.length,
          }),
        ],
      ];

      for (const [kind, applies, line] of candidates) {
        if (!applies) continue;
        const milestone = dueMilestone(kind, days);
        if (milestone === null) continue;
        if (alreadySent.has(reminderKey(entry.id, kind, milestone))) continue;
        bucket.lines.push(line());
        bucket.items.push({ entryId: entry.id, kind, milestone });
      }

      // The forecast needs a request, so it is not one of the sync candidates.
      const forecastMilestone = entry.location
        ? dueMilestone(TripReminderKind.FORECAST, days)
        : null;
      if (
        forecastMilestone !== null &&
        !alreadySent.has(
          reminderKey(entry.id, TripReminderKind.FORECAST, forecastMilestone),
        )
      ) {
        const summary = await this.forecastSummary(entry, now);
        // No forecast (service down): not marked as sent, so the next run retries.
        if (summary) {
          bucket.lines.push({
            entryName: entry.name,
            days,
            kind: TripReminderKind.FORECAST,
            items: [],
            forecast: summary,
          });
          bucket.items.push({
            entryId: entry.id,
            kind: TripReminderKind.FORECAST,
            milestone: forecastMilestone,
          });
        }
      }
      if (bucket.lines.length) byUser.set(entry.userId, bucket);
    }

    let sent = 0;
    for (const [userId, { lines, items }] of byUser) {
      const delivered = await this.notifications.emailUser(userId, {
        setting: 'tripEmailNotifications',
        logType: LOG_TYPE,
        ...tripReminderCopy(lines),
        // The log entry IS the "already sent" record for each milestone.
        meta: {
          items: items.map(({ entryId, kind, milestone }) => ({
            entryId,
            kind,
            milestone,
          })),
        },
      });
      if (delivered) sent++;
    }
    return sent;
  }

  /** One line for the first forecast day, or null when there is none. */
  private async forecastSummary(
    entry: Parameters<ForecastService['build']>[0],
    now: Date,
  ): Promise<string | null> {
    try {
      const forecast = await this.forecast.build(entry, now);
      const first = forecast.days[0];
      return forecast.available && first ? forecastLine(first.summary) : null;
    } catch {
      return null;
    }
  }

  /** Milestones delivered in the last 60 days, as reminderKey strings. */
  private async sentKeys(userIds: string[]): Promise<Set<string>> {
    if (userIds.length === 0) return new Set();
    const logs = await this.prisma.notificationLog.findMany({
      where: {
        userId: { in: [...new Set(userIds)] },
        type: LOG_TYPE,
        status: 'SENT',
        sentAt: { gte: new Date(Date.now() - 60 * 864e5) },
      },
      select: { meta: true },
    });
    const keys = new Set<string>();
    for (const log of logs) {
      const items = (log.meta as { items?: SentItem[] } | null)?.items ?? [];
      for (const i of items)
        keys.add(reminderKey(i.entryId, i.kind, i.milestone));
    }
    return keys;
  }
}

const nameOf = (g: { brand: string; model: string }) => `${g.brand} ${g.model}`;

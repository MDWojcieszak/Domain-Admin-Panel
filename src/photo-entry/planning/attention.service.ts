import { Injectable } from '@nestjs/common';
import {
  GearOwnership,
  PhotoEntryCommentKind,
  PhotoEntryStatus,
} from '@prisma/client';

import { GearItemsSort } from '../../gear/dto';
import { GearService } from '../../gear/gear.service';
import { PrismaService } from '../../prisma/prisma.service';
import { stageOf } from '../comments/photo-entry-comment-rules';
import { PhotoEntryGearService } from '../gear/photo-entry-gear.service';
import { daysUntil } from './trip-reminders';
import { AttentionResponse } from './responses';

const WISHLIST_HORIZON_DAYS = 30;

/**
 * Everything on the user's photo entries that needs a decision, in one call
 * (docs/photo-entry-planning-and-publish.md §6). Nothing here is stored.
 */
@Injectable()
export class AttentionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entryGear: PhotoEntryGearService,
    private readonly gear: GearService,
  ) {}

  async get(
    userId: string,
    now: Date = new Date(),
  ): Promise<AttentionResponse> {
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const [planned, pending, wishlist, todos] = await Promise.all([
      // The mirror image of the old stale ACTIVE: planned, dates over, never
      // moved. endDate ?? startDate is the last day of the entry.
      this.prisma.photoEntry.findMany({
        where: {
          userId,
          status: PhotoEntryStatus.PLANNED,
          OR: [
            { endDate: { lt: today } },
            { endDate: null, startDate: { lt: today } },
          ],
        },
        select: { id: true, name: true, startDate: true, endDate: true },
      }),
      this.entryGear.pendingMedia(userId, now),
      this.gear.listItems({
        ownership: GearOwnership.WISHLIST,
        sort: GearItemsSort.NEEDED_BY,
        neededWithinDays: WISHLIST_HORIZON_DAYS,
      }),
      this.prisma.photoEntryComment.findMany({
        where: {
          kind: PhotoEntryCommentKind.TODO,
          resolvedAt: null,
          photoEntry: { userId },
        },
        include: { photoEntry: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      }),
    ]);

    const pastPlanned = planned
      .map((e) => ({
        photoEntryId: e.id,
        name: e.name,
        startDate: e.startDate,
        endDate: e.endDate,
        daysOver: -daysUntil((e.endDate ?? e.startDate)!, now),
      }))
      .sort((a, b) => b.daysOver - a.daysOver);

    const unsecuredOverdue = pending.unsecured
      .filter((e) => e.overdue)
      .map((e) => ({ ...e, items: e.items.filter((i) => i.overdue) }));

    const openTodos = todos.map((c) => ({
      commentId: c.id,
      body: c.body,
      photoEntryId: c.photoEntryId,
      entryName: c.photoEntry.name,
      stage: stageOf(c.atStatus, c.atPostStage),
      createdAt: c.createdAt,
    }));

    return {
      pastPlanned,
      unsecuredOverdue,
      undeclared: pending.undeclared,
      wishlistDueSoon: wishlist.items,
      openTodos,
      counts: {
        pastPlanned: pastPlanned.length,
        unsecuredOverdue: unsecuredOverdue.length,
        undeclared: pending.undeclared.length,
        wishlistDueSoon: wishlist.items.length,
        openTodos: openTodos.length,
      },
    };
  }
}

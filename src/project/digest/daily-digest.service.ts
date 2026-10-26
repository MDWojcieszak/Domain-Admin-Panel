import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  AccountStatus,
  BomStatus,
  ProjectRole,
  ProjectType,
  StatusCategory,
} from '@prisma/client';

import { NotificationService } from '../../notification/notification.service';
import { PrismaService } from '../../prisma/prisma.service';
import { dateIn } from '../calendar/ical';
import { taskKey } from '../project-defaults';
import { buildDigest, DigestBuild, DigestInput } from './digest-rules';

const LOG_TYPE = 'DAILY_DIGEST';
/** The same zone the calendar feed uses to decide what "today" is. */
const TIME_ZONE = process.env.CALENDAR_TIMEZONE || 'Europe/Warsaw';
const DAY_MS = 86_400_000;

const daysBetween = (from: string, to: string) =>
  Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS,
  );

/**
 * The morning mail (opt-in, dailyDigestEmail): what is due today, what is
 * late, what builds still need bought and what is left on shopping lists.
 * Sent once a day per account, deduplicated against NotificationLog, so a
 * restart at seven does not send it twice. An empty day sends nothing.
 */
@Injectable()
export class DailyDigestService {
  private readonly logger = new Logger(DailyDigestService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron('0 7 * * *', { timeZone: TIME_ZONE })
  async run(): Promise<void> {
    try {
      const sent = await this.sendAll();
      if (sent) this.logger.log(`Sent ${sent} daily digest(s)`);
    } catch (err) {
      this.logger.error(`Daily digest run failed: ${(err as Error).message}`);
    }
  }

  /** Returns how many went out. */
  async sendAll(now: Date = new Date()): Promise<number> {
    const day = dateIn(now, TIME_ZONE);
    const users = await this.prisma.user.findMany({
      where: {
        accountStatus: AccountStatus.ACTIVE,
        deletedAt: null,
        userSettings: { is: { dailyDigestEmail: true } },
      },
      select: { id: true },
    });
    let sent = 0;
    for (const { id } of users) {
      const already = await this.prisma.notificationLog.count({
        where: {
          userId: id,
          type: LOG_TYPE,
          status: 'SENT',
          meta: { path: ['day'], equals: day },
        },
      });
      if (already) continue;
      const copy = buildDigest(await this.collect(id, now));
      if (!copy) continue;
      const ok = await this.notifications.emailUser(id, {
        setting: 'dailyDigestEmail',
        logType: LOG_TYPE,
        ...copy,
        meta: { day },
        path: '/projects/my-work',
      });
      if (ok) sent++;
    }
    return sent;
  }

  /** Everything the digest says, for one account, as of now. */
  async collect(userId: string, now: Date = new Date()): Promise<DigestInput> {
    const today = dateIn(now, TIME_ZONE);
    const visible = {
      archivedAt: null,
      isTemplate: false,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    };

    const tasks = await this.prisma.task.findMany({
      where: {
        dueDate: { lte: new Date(now.getTime() + 2 * DAY_MS) },
        status: { category: { not: StatusCategory.DONE } },
        project: visible,
        OR: [
          { assigneeId: userId },
          { project: { isInbox: true, ownerId: userId } },
        ],
      },
      include: {
        project: { select: { key: true, title: true, isInbox: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 200,
    });
    const asTask = (t: (typeof tasks)[number]) => ({
      key: taskKey(t.project.key, t.number),
      title: t.title,
      where: t.project.isInbox ? 'Inbox' : t.project.title,
    });
    const dueToday = tasks
      .filter((t) => dateIn(t.dueDate!, TIME_ZONE) === today)
      .map(asTask);
    const late = tasks
      .map((t) => ({
        t,
        days: daysBetween(dateIn(t.dueDate!, TIME_ZONE), today),
      }))
      .filter(({ days }) => days > 0)
      .map(({ t, days }) => ({ ...asTask(t), daysLate: days }));

    // Parts to buy, in builds you work on (a viewer of someone's build buys nothing).
    const parts = await this.prisma.bomItem.findMany({
      where: {
        status: BomStatus.NEEDED,
        project: {
          ...visible,
          OR: [
            { ownerId: userId },
            {
              members: { some: { userId, role: { not: ProjectRole.VIEWER } } },
            },
          ],
        },
      },
      select: {
        projectId: true,
        quantity: true,
        unitPrice: true,
        currency: true,
        project: { select: { title: true } },
      },
    });
    const builds = new Map<string, DigestBuild>();
    for (const part of parts) {
      const build = builds.get(part.projectId) ?? {
        project: part.project.title,
        parts: 0,
        costs: [],
      };
      build.parts++;
      if (part.unitPrice) {
        const cost = part.quantity.toNumber() * part.unitPrice.toNumber();
        const row = build.costs.find((c) => c.currency === part.currency);
        if (row) row.total = Math.round((row.total + cost) * 100) / 100;
        else
          build.costs.push({
            currency: part.currency,
            total: Math.round(cost * 100) / 100,
          });
      }
      builds.set(part.projectId, build);
    }

    const lists = await this.prisma.project.findMany({
      where: { ...visible, type: ProjectType.LIST },
      select: {
        title: true,
        _count: {
          select: {
            tasks: {
              where: { status: { category: { not: StatusCategory.DONE } } },
            },
          },
        },
      },
    });

    return {
      today: dueToday,
      late,
      builds: [...builds.values()],
      lists: lists.map((l) => ({ project: l.title, open: l._count.tasks })),
    };
  }
}

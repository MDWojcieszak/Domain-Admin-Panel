import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CalendarScope, Prisma, StatusCategory } from '@prisma/client';
import { randomBytes } from 'crypto';

import { PrismaService } from '../../prisma/prisma.service';
import { taskKey } from '../project-defaults';
import { hashShareToken } from '../project-share.service';
import { CalendarEvent, dateIn, renderCalendar } from './ical';
import { CalendarFeedDto } from './calendar.dto';
import {
  CalendarFeedResponse,
  CreatedCalendarFeedResponse,
} from './calendar.response';

const DAY_MS = 86_400_000;
/** Done tasks stay on the calendar, ticked, this long; open ones as long as they are open. */
const PAST_DAYS = 30;
const FUTURE_DAYS = 400;

/**
 * Due dates in the phone's own calendar: a private iCal address per account,
 * fetched by the calendar app on its own schedule. Read-only by design; the
 * panel stays where tasks are changed.
 */
@Injectable()
export class CalendarService {
  private readonly panelUrl: string;
  private readonly timeZone: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.panelUrl = (
      config.get<string>('INTERFACE_URL') ||
      config.get<string>('APP_URL') ||
      ''
    ).replace(/\/+$/, '');
    // Due dates are calendar days; this is the zone that decides which day.
    this.timeZone = config.get<string>('CALENDAR_TIMEZONE') || 'Europe/Warsaw';
  }

  async get(userId: string): Promise<CalendarFeedResponse> {
    const feed = await this.prisma.calendarFeed.findUnique({
      where: { userId },
    });
    return feed
      ? {
          enabled: true,
          scope: feed.scope,
          lastUsedAt: feed.lastUsedAt,
          createdAt: feed.createdAt,
        }
      : {
          enabled: false,
          scope: CalendarScope.MINE,
          lastUsedAt: null,
          createdAt: null,
        };
  }

  /** A fresh token; any address given out before stops working at once. */
  async rotate(
    userId: string,
    dto: CalendarFeedDto,
  ): Promise<CreatedCalendarFeedResponse> {
    const token = randomBytes(24).toString('base64url');
    const feed = await this.prisma.calendarFeed.upsert({
      where: { userId },
      create: {
        userId,
        tokenHash: hashShareToken(token),
        scope: dto.scope ?? CalendarScope.MINE,
      },
      update: {
        tokenHash: hashShareToken(token),
        lastUsedAt: null,
        ...(dto.scope ? { scope: dto.scope } : {}),
      },
    });
    return {
      enabled: true,
      scope: feed.scope,
      lastUsedAt: null,
      createdAt: feed.createdAt,
      token,
    };
  }

  async update(
    userId: string,
    dto: CalendarFeedDto,
  ): Promise<CalendarFeedResponse> {
    const feed = await this.prisma.calendarFeed.findUnique({
      where: { userId },
    });
    if (!feed) throw new NotFoundException('Turn the calendar on first.');
    await this.prisma.calendarFeed.update({
      where: { userId },
      data: { scope: dto.scope },
    });
    return this.get(userId);
  }

  async remove(userId: string): Promise<void> {
    await this.prisma.calendarFeed.deleteMany({ where: { userId } });
  }

  /** The .ics behind a token; an unknown or replaced token is a plain 404. */
  async render(token: string, now: Date = new Date()): Promise<string> {
    const feed = await this.prisma.calendarFeed.findUnique({
      where: { tokenHash: hashShareToken(token) },
    });
    if (!feed) throw new NotFoundException('No such calendar.');
    await this.prisma.calendarFeed.update({
      where: { id: feed.id },
      data: { lastUsedAt: now },
    });

    const userId = feed.userId;
    const visible: Prisma.ProjectWhereInput = {
      archivedAt: null,
      isTemplate: false,
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    };
    const tasks = await this.prisma.task.findMany({
      where: {
        dueDate: {
          gte: new Date(now.getTime() - PAST_DAYS * DAY_MS),
          lte: new Date(now.getTime() + FUTURE_DAYS * DAY_MS),
        },
        project: visible,
        ...(feed.scope === CalendarScope.MINE
          ? {
              OR: [
                { assigneeId: userId },
                { project: { isInbox: true, ownerId: userId } },
              ],
            }
          : {}),
        // Open tasks always; done ones only while recent.
        AND: [
          {
            OR: [
              { status: { category: { not: StatusCategory.DONE } } },
              {
                completedAt: {
                  gte: new Date(now.getTime() - PAST_DAYS * DAY_MS),
                },
              },
            ],
          },
        ],
      },
      include: {
        status: { select: { category: true } },
        project: {
          select: { id: true, key: true, title: true, isInbox: true },
        },
      },
      take: 2000,
    });
    const projects = await this.prisma.project.findMany({
      where: {
        ...visible,
        isInbox: false,
        dueDate: { gte: new Date(now.getTime() - PAST_DAYS * DAY_MS) },
      },
      select: {
        id: true,
        key: true,
        title: true,
        dueDate: true,
        status: true,
        updatedAt: true,
      },
    });

    const events: CalendarEvent[] = [
      ...tasks.map((task) => {
        const done = task.status.category === StatusCategory.DONE;
        const where = task.project.isInbox ? 'Inbox' : task.project.title;
        return {
          uid: `task-${task.id}@photo-gallery`,
          date: dateIn(task.dueDate!, this.timeZone),
          summary: `${done ? '✓ ' : ''}${task.title}`,
          description: [
            `${taskKey(task.project.key, task.number)} · ${where}`,
            task.notes,
          ]
            .filter(Boolean)
            .join('\n\n'),
          categories: where,
          url: this.panelUrl
            ? `${this.panelUrl}/projects/${task.project.id}?task=${task.id}`
            : undefined,
          // A done task rings no more.
          alarmAt: done ? null : task.reminderAt,
          updatedAt: task.updatedAt,
        };
      }),
      ...projects.map((project) => ({
        uid: `project-${project.id}@photo-gallery`,
        date: dateIn(project.dueDate!, this.timeZone),
        summary: `${project.status === 'DONE' ? '✓ ' : ''}${project.title} due`,
        description: `${project.key} · project due date`,
        categories: project.title,
        url: this.panelUrl
          ? `${this.panelUrl}/projects/${project.id}`
          : undefined,
        updatedAt: project.updatedAt,
      })),
    ];
    return renderCalendar('Projects', events, now);
  }
}

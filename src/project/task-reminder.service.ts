import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { StatusCategory } from '@prisma/client';

import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { taskKey } from './project-defaults';
import {
  REMINDER_ATTEMPTS,
  REMINDER_GRACE_MS,
  reminderKey,
} from './task-rules';

const LOG_TYPE = 'TASK_REMINDER';

/**
 * Task reminders by email (phase 6): when a task's reminder time comes and it
 * is not done yet, its assignee hears of it, or with nobody assigned, whoever
 * created it. Each reminder time is sent once, deduplicated against
 * NotificationLog; moving the time makes a new reminder.
 */
@Injectable()
export class TaskReminderService {
  private readonly logger = new Logger(TaskReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    try {
      const sent = await this.remind();
      if (sent) this.logger.log(`Sent ${sent} task reminder(s)`);
    } catch (err) {
      this.logger.error(`Task reminder run failed: ${(err as Error).message}`);
    }
  }

  /** Returns how many reminders went out. */
  async remind(now: Date = new Date()): Promise<number> {
    const tasks = await this.prisma.task.findMany({
      where: {
        // A reminder found too late (the server was down for days) is dropped.
        reminderAt: {
          lte: now,
          gte: new Date(now.getTime() - REMINDER_GRACE_MS),
        },
        status: { category: { not: StatusCategory.DONE } },
        project: { isTemplate: false, archivedAt: null },
      },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            key: true,
            isInbox: true,
            ownerId: true,
          },
        },
      },
      take: 500,
    });
    if (!tasks.length) return 0;

    const attempts = await this.attempts(tasks.map((t) => t.id));
    let sent = 0;
    for (const task of tasks) {
      const key = reminderKey(task.id, task.reminderAt!);
      const tried = attempts.get(key);
      if (tried?.sent || (tried?.failed ?? 0) >= REMINDER_ATTEMPTS) continue;

      const recipient =
        task.assigneeId ?? task.createdById ?? task.project.ownerId;
      const where = task.project.isInbox ? 'your inbox' : task.project.title;
      const ok = await this.notifications.emailUser(recipient, {
        setting: 'taskEmailNotifications',
        logType: LOG_TYPE,
        subject: `Reminder: ${task.title}`,
        subjectName: taskKey(task.project.key, task.number),
        headline: task.title,
        detail: [
          `In ${where}.`,
          task.dueDate
            ? `Due ${task.dueDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}.`
            : '',
          task.notes ? task.notes.slice(0, 500) : '',
        ]
          .filter(Boolean)
          .join(' '),
        meta: { key, taskId: task.id, projectId: task.project.id },
      });
      if (ok) sent++;
    }
    return sent;
  }

  /** What was already tried for these tasks, per reminder. */
  private async attempts(taskIds: string[]) {
    const logs = await this.prisma.notificationLog.findMany({
      where: {
        type: LOG_TYPE,
        OR: taskIds.map((taskId) => ({
          meta: { path: ['taskId'], equals: taskId },
        })),
      },
      select: { status: true, meta: true },
    });
    const byKey = new Map<string, { sent: boolean; failed: number }>();
    for (const log of logs) {
      const key = (log.meta as { key?: string } | null)?.key;
      if (!key) continue;
      const row = byKey.get(key) ?? { sent: false, failed: 0 };
      if (log.status === 'SENT') row.sent = true;
      else row.failed++;
      byKey.set(key, row);
    }
    return byKey;
  }
}

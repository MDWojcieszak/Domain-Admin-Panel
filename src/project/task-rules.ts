import { RepeatType } from '@prisma/client';

/** "3d", "2w", "6m", "1y": a custom repeat, every so many days, weeks, months or years. */
export const CUSTOM_REPEAT = /^([1-9]\d{0,2})\s*([dwmy])$/i;

type Step = { unit: 'd' | 'w' | 'm' | 'y'; count: number };

export const repeatStep = (
  repeat: RepeatType,
  custom?: string | null,
): Step | null => {
  switch (repeat) {
    case RepeatType.DAILY:
      return { unit: 'd', count: 1 };
    case RepeatType.WEEKLY:
      return { unit: 'w', count: 1 };
    case RepeatType.MONTHLY:
      return { unit: 'm', count: 1 };
    case RepeatType.YEARLY:
      return { unit: 'y', count: 1 };
    case RepeatType.CUSTOM: {
      const match = custom ? CUSTOM_REPEAT.exec(custom.trim()) : null;
      return match
        ? {
            unit: match[2].toLowerCase() as Step['unit'],
            count: Number(match[1]),
          }
        : null;
    }
    default:
      return null;
  }
};

/** Months move by the calendar and keep the day, clamped: 31 Jan → 28/29 Feb. */
const advance = (date: Date, { unit, count }: Step): Date => {
  const next = new Date(date);
  if (unit === 'd') next.setUTCDate(next.getUTCDate() + count);
  else if (unit === 'w') next.setUTCDate(next.getUTCDate() + 7 * count);
  else {
    const months = unit === 'm' ? count : 12 * count;
    const day = next.getUTCDate();
    next.setUTCDate(1);
    next.setUTCMonth(next.getUTCMonth() + months);
    const last = new Date(
      Date.UTC(next.getUTCFullYear(), next.getUTCMonth() + 1, 0),
    ).getUTCDate();
    next.setUTCDate(Math.min(day, last));
  }
  return next;
};

/**
 * When the next occurrence is due: one step after the last due date, and on
 * past today when the task was done late, so a weekly chore finished a month
 * late does not reappear four times overdue. Null when the task does not
 * repeat (or its custom rule makes no sense).
 */
export const nextOccurrence = (
  due: Date,
  repeat: RepeatType,
  custom: string | null | undefined,
  now: Date = new Date(),
): Date | null => {
  const step = repeatStep(repeat, custom);
  if (!step) return null;
  let next = advance(due, step);
  for (let guard = 0; next <= now && guard < 1000; guard++) {
    next = advance(next, step);
  }
  return next;
};

/** Reminders older than this when first seen are dropped, not sent late. */
export const REMINDER_GRACE_MS = 2 * 24 * 60 * 60 * 1000;

/** At most this many tries for one reminder when the mail keeps failing. */
export const REMINDER_ATTEMPTS = 3;

/** One reminder: a task at one reminder time; moving the time makes a new one. */
export const reminderKey = (taskId: string, reminderAt: Date) =>
  `${taskId}@${reminderAt.toISOString()}`;

// — progress you can see —

const DAY_MS = 86_400_000;

const shiftDay = (day: string, by: number) =>
  new Date(Date.parse(`${day}T12:00:00Z`) + by * DAY_MS)
    .toISOString()
    .slice(0, 10);

/** The Monday of the week a day falls in (YYYY-MM-DD in, YYYY-MM-DD out). */
export const weekStart = (day: string) => {
  const weekday = new Date(`${day}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return shiftDay(day, -((weekday + 6) % 7));
};

/**
 * Days in a row with something done, counting back from today; a streak
 * still counts this morning if yesterday had something, so it does not
 * break before the day has had a chance.
 */
export const streakDays = (doneDays: Set<string>, today: string) => {
  let day = doneDays.has(today) ? today : shiftDay(today, -1);
  let streak = 0;
  while (doneDays.has(day)) {
    streak++;
    day = shiftDay(day, -1);
  }
  return streak;
};

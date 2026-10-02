import { GearCategory } from '@prisma/client';

import {
  GearMediaSource,
  mediaSourceOf,
  reminderDaysFor,
  SECURE_ACTION,
} from '../../gear/gear-media-source';
import { needsSecuring } from './photo-entry-gear-rules';

/**
 * Unsecured media and when to nag about it (docs/photo-entry-redesign.md §6).
 * Pure, so the thresholds are tested without a clock or a database.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PendingEntryInput {
  startDate: Date | null;
  endDate: Date | null;
}

export interface PendingRowInput {
  category: GearCategory;
  used: boolean;
  secured: boolean;
  createdAt: Date;
  remindedAt: Date | null;
}

export interface PendingAssessment {
  mediaSource: GearMediaSource;
  secureAction: string;
  /** When the material started waiting. */
  since: Date;
  daysPending: number;
  reminderDays: number;
  /** Past the source's threshold. */
  overdue: boolean;
  /** Overdue and not reminded within the last threshold period. */
  remindDue: boolean;
}

/**
 * The clock starts when the material exists — the end of the shoot. An entry
 * added after the fact without dates falls back to when the gear was put on
 * it, which is the earliest moment the backend knew. Never in the future: a
 * mis-dated SHOT entry must not postpone its own reminder.
 */
export const pendingSince = (
  entry: PendingEntryInput,
  row: Pick<PendingRowInput, 'createdAt'>,
  now: Date,
): Date => {
  const start = entry.endDate ?? entry.startDate ?? row.createdAt;
  return start.getTime() > now.getTime() ? now : start;
};

/** Null when the row has nothing waiting to be secured. */
export const assessRow = (
  entry: PendingEntryInput,
  row: PendingRowInput,
  now: Date = new Date(),
): PendingAssessment | null => {
  if (!needsSecuring(row)) return null;

  const mediaSource = mediaSourceOf(row.category);
  // needsSecuring guarantees a source, so neither of these is null.
  const reminderDays = reminderDaysFor(row.category)!;
  const secureAction = SECURE_ACTION[mediaSource]!;

  const since = pendingSince(entry, row, now);
  const daysPending = Math.floor((now.getTime() - since.getTime()) / DAY_MS);
  const overdue = daysPending >= reminderDays;

  // Repeat every threshold period until secured: once is easy to miss, daily
  // would teach the user to ignore it — the same reasoning as the thresholds.
  const remindDue =
    overdue &&
    (row.remindedAt === null ||
      now.getTime() - row.remindedAt.getTime() >= reminderDays * DAY_MS);

  return {
    mediaSource,
    secureAction,
    since,
    daysPending,
    reminderDays,
    overdue,
    remindDue,
  };
};

export interface ReminderLine {
  entryName: string;
  gearName: string;
  secureAction: string;
  daysPending: number;
}

export interface ReminderCopy {
  subject: string;
  subjectName: string;
  headline: string;
  detail: string;
}

/** One digest per user and run, however many rows are due. */
export const reminderCopy = (lines: ReminderLine[]): ReminderCopy => {
  const entries = [...new Set(lines.map((l) => l.entryName))];
  const single = entries.length === 1;

  const detail = lines
    .map(
      (l) =>
        `${single ? '' : `${l.entryName}: `}${l.gearName} — ${l.secureAction} ` +
        `(waiting ${l.daysPending} ${l.daysPending === 1 ? 'day' : 'days'})`,
    )
    .join(' · ');

  if (single) {
    return {
      subject: `${entries[0]} still has unsecured media`,
      subjectName: entries[0],
      headline: 'still has unsecured media',
      detail,
    };
  }

  return {
    subject: `${entries.length} photo entries still have unsecured media`,
    subjectName: `${entries.length} photo entries`,
    headline: 'still have unsecured media',
    detail,
  };
};

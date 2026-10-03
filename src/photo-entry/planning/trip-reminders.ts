/**
 * Pre-trip reminders (docs/photo-entry-planning-and-publish.md §7). Pure, so
 * the milestone rules are tested without a clock or a database.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export enum TripReminderKind {
  /** Wishlist gear still not bought. */
  SHOPPING = 'SHOPPING',
  /** Owned gear on the list not packed yet. */
  PACKING = 'PACKING',
  /** Weather at the place — needs a location. */
  FORECAST = 'FORECAST',
}

/** Days before the start at which each reminder fires — once per milestone. */
export const TRIP_MILESTONES: Record<TripReminderKind, readonly number[]> = {
  [TripReminderKind.SHOPPING]: [30, 7],
  [TripReminderKind.PACKING]: [1],
  [TripReminderKind.FORECAST]: [3],
};

const startOfDay = (date: Date): number => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Whole calendar days from today to the start; negative once it began. */
export const daysUntil = (start: Date, now: Date = new Date()): number =>
  Math.round((startOfDay(start) - startOfDay(now)) / DAY_MS);

/**
 * The milestone currently due, or null. It is the TIGHTEST milestone already
 * reached: an entry planned five days ahead gets the 7-day reminder, never a
 * belated "30 days to go". Nothing fires once the trip has started.
 */
export const dueMilestone = (
  kind: TripReminderKind,
  days: number,
): number | null => {
  if (days < 0) return null;
  const reached = TRIP_MILESTONES[kind].filter((m) => days <= m);
  return reached.length ? Math.min(...reached) : null;
};

export const reminderKey = (
  entryId: string,
  kind: TripReminderKind,
  milestone: number,
): string => `${entryId}:${kind}:${milestone}`;

export interface TripReminderLine {
  entryName: string;
  days: number;
  kind: TripReminderKind;
  /** SHOPPING: items to buy; PACKING: items still missing. */
  items: string[];
  /** SHOPPING only: sum of the known estimated prices. */
  total?: number;
  /** PACKING only. */
  packed?: number;
  of?: number;
  /** FORECAST only: one line of the first day's summary. */
  forecast?: string;
}

const when = (days: number): string =>
  days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;

export const tripReminderCopy = (lines: TripReminderLine[]) => {
  const entries = [...new Set(lines.map((l) => l.entryName))];
  const detail = lines
    .map((l) => {
      const head = `${l.entryName} (${when(l.days)})`;
      if (l.kind === TripReminderKind.FORECAST) {
        return `${head}: forecast — ${l.forecast}`;
      }
      if (l.kind === TripReminderKind.SHOPPING) {
        const total = l.total ? ` — about ${l.total}` : '';
        return `${head}: still to buy ${l.items.join(', ')}${total}`;
      }
      return `${head}: packed ${l.packed} of ${l.of}, missing ${l.items.join(', ')}`;
    })
    .join(' · ');

  const single = entries.length === 1;
  return {
    subject: single
      ? `Getting ready for ${entries[0]}`
      : `Getting ready for ${entries.length} trips`,
    subjectName: single ? entries[0] : `${entries.length} trips`,
    headline: single ? 'is coming up' : 'are coming up',
    detail,
  };
};

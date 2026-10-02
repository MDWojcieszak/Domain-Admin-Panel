import { GearOwnership, PhotoEntryStatus } from '@prisma/client';

/**
 * When a piece of gear is needed, derived from the entries it is attached to
 * (docs/photo-entry-redesign.md §4). Nothing here is persisted: the dates on
 * the entries already know.
 *
 * The same value means different things by ownership — a purchase deadline for
 * WISHLIST, the next use for OWNED, a stale plan for RETIRED — but it is
 * computed identically, so the wishlist is just a filter over one view.
 */

export interface AttachedEntry {
  id: string;
  name: string;
  status: PhotoEntryStatus;
  startDate: Date | null;
}

export interface GearNeed {
  /** Earliest upcoming PLANNED entry, or null when nothing dated needs it. */
  neededBy: Date | null;
  neededFor: AttachedEntry | null;
  /** WISHLIST only: shoots that already happened without it being bought. */
  missedFor: AttachedEntry[];
}

/** Start of the given day, so an entry dated today still counts as upcoming. */
export const startOfDay = (now: Date): Date => {
  const day = new Date(now);
  day.setHours(0, 0, 0, 0);
  return day;
};

export const computeGearNeed = (
  ownership: GearOwnership,
  entries: AttachedEntry[],
  now: Date = new Date(),
): GearNeed => {
  const today = startOfDay(now).getTime();

  // CANCELLED never counts, and an undated plan sets no deadline.
  const upcoming = entries
    .filter(
      (e) =>
        e.status === PhotoEntryStatus.PLANNED &&
        e.startDate !== null &&
        e.startDate.getTime() >= today,
    )
    .sort((a, b) => a.startDate!.getTime() - b.startDate!.getTime());

  const neededFor = upcoming[0] ?? null;

  // Silence here would lose information: either the trip went fine without it
  // (and the item can probably go), or its absence cost something.
  const missedFor =
    ownership === GearOwnership.WISHLIST
      ? entries.filter((e) => e.status === PhotoEntryStatus.SHOT)
      : [];

  return {
    neededBy: neededFor?.startDate ?? null,
    neededFor,
    missedFor,
  };
};

/** Last day (inclusive) of a `neededWithinDays` horizon. */
export const horizonEnd = (days: number, now: Date = new Date()): Date => {
  const end = startOfDay(now);
  end.setDate(end.getDate() + days + 1);
  return new Date(end.getTime() - 1);
};

export interface PlanSortable {
  neededBy: Date | null;
  priority: number | null;
}

/**
 * Soonest deadline first, undated last; `priority` (0 = must-have) breaks ties.
 * Stable for everything else, so the caller's base order survives.
 */
export const compareByNeed = (a: PlanSortable, b: PlanSortable): number => {
  const byDate = nullsLast(a.neededBy?.getTime(), b.neededBy?.getTime());
  if (byDate !== 0) return byDate;
  return nullsLast(a.priority ?? undefined, b.priority ?? undefined);
};

const nullsLast = (a: number | undefined, b: number | undefined): number => {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  return a - b;
};

/**
 * P12 — gear may be deleted while it carries only plans. Once any entry
 * records it as used or secured, deleting it would erase what archived photos
 * were taken with, so it can only be retired.
 */
export const deletionBlocked = (
  rows: Array<{ used: boolean; secured: boolean }>,
): boolean => rows.some((r) => r.used || r.secured);

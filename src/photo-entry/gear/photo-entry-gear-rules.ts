import {
  GearCategory,
  GearOwnership,
  MediaStatus,
  PhotoEntryStatus,
} from '@prisma/client';

import { producesMedia } from '../../gear/gear-media-source';

/**
 * Rules for the gear list of a photo entry (docs/photo-entry-redesign.md D4,
 * §4–§6). Pure, so every invariant here is tested without a database.
 */

/** What the one gear list means at the entry's current status (D4). */
export enum EntryGearPhase {
  /** PLANNED — the packing list; tick `packed`. */
  PACK = 'PACK',
  /** SHOT — the securing list; tick `secured` on used gear with media. */
  SECURE = 'SECURE',
  /** CANCELLED — the list is kept for the record but asks nothing. */
  NONE = 'NONE',
}

export const gearPhaseOf = (status: PhotoEntryStatus): EntryGearPhase => {
  switch (status) {
    case PhotoEntryStatus.PLANNED:
      return EntryGearPhase.PACK;
    case PhotoEntryStatus.SHOT:
      return EntryGearPhase.SECURE;
    case PhotoEntryStatus.CANCELLED:
      return EntryGearPhase.NONE;
  }
};

/** Rows the list should flag instead of listing as if nothing happened (§4). */
export enum EntryGearWarning {
  /** Planned trip still lists gear that has since been sold. */
  RETIRED = 'RETIRED',
  /** The shoot happened, but this was only ever on the wishlist. */
  NOT_OWNED = 'NOT_OWNED',
}

export const rowWarning = (
  status: PhotoEntryStatus,
  ownership: GearOwnership,
): EntryGearWarning | null => {
  if (
    status === PhotoEntryStatus.PLANNED &&
    ownership === GearOwnership.RETIRED
  )
    return EntryGearWarning.RETIRED;
  if (status === PhotoEntryStatus.SHOT && ownership === GearOwnership.WISHLIST)
    return EntryGearWarning.NOT_OWNED;
  return null;
};

export interface GearRowState {
  category: GearCategory;
  used: boolean;
  secured: boolean;
}

/** Does the row belong on the list for this phase (D4)? */
export const listedInPhase = (
  phase: EntryGearPhase,
  row: GearRowState,
): boolean => {
  switch (phase) {
    case EntryGearPhase.PACK:
      return true;
    case EntryGearPhase.SECURE:
      return row.used && producesMedia(row.category);
    case EntryGearPhase.NONE:
      return false;
  }
};

export const needsSecuring = (row: GearRowState): boolean =>
  row.used && producesMedia(row.category) && !row.secured;

/**
 * §6 — material is secured when the gear has been declared and every used
 * piece that produces media has been secured. Undeclared is "unknown", which
 * is not the same as "not secured" — hence null.
 */
export const mediaSecured = (
  gearConfirmedAt: Date | null,
  rows: GearRowState[],
): boolean | null => {
  if (!gearConfirmedAt) return null;
  return !rows.some(needsSecuring);
};

/** The stored column (P4): unknown counts as not uploaded. */
export const uploadStatusOf = (
  gearConfirmedAt: Date | null,
  rows: GearRowState[],
): MediaStatus =>
  mediaSecured(gearConfirmedAt, rows) === true
    ? MediaStatus.UPLOADED
    : MediaStatus.NOT_UPLOADED;

/**
 * Applies a patch to a row's flags. Securing implies use (you cannot offload
 * a card from a camera you did not shoot with), and un-using clears securing,
 * so the two can never contradict each other.
 */
export const resolveRowFlags = (
  current: { used: boolean; secured: boolean },
  patch: { used?: boolean; secured?: boolean },
): { used: boolean; secured: boolean } => {
  let used = patch.used ?? current.used;
  let secured = patch.secured ?? current.secured;
  if (patch.secured === true) used = true;
  if (patch.used === false) secured = false;
  return { used, secured };
};

/** Why a row cannot hold these flags, or null when it can. */
export const rowFlagsViolation = (
  ctx: {
    entryStatus: PhotoEntryStatus;
    ownership: GearOwnership;
    category: GearCategory;
  },
  flags: { used: boolean; secured: boolean },
): string | null => {
  if (!flags.used && !flags.secured) return null;

  // P13 — use is a fact about a shoot that happened.
  if (ctx.entryStatus !== PhotoEntryStatus.SHOT) {
    return 'Gear can be marked used or secured only on a SHOT entry';
  }
  // P11 — RETIRED is allowed: filling in an old entry shot with a body that
  // has since been sold is exactly what the history is for.
  if (ctx.ownership === GearOwnership.WISHLIST) {
    return 'Wishlist gear cannot be marked used or secured — it is not owned';
  }
  // P3 — a tripod has nothing to secure.
  if (flags.secured && !producesMedia(ctx.category)) {
    return `${ctx.category} produces no media, so there is nothing to secure`;
  }
  return null;
};

/**
 * P13, from the other side — moving an entry off SHOT while gear is recorded
 * as used would claim a shoot both did and did not happen.
 */
export const statusChangeConflict = (
  nextStatus: PhotoEntryStatus,
  rows: Array<{ used: boolean; secured: boolean }>,
): string | null =>
  nextStatus !== PhotoEntryStatus.SHOT && rows.some((r) => r.used || r.secured)
    ? `Cannot move to ${nextStatus} while gear is recorded as used — clear "used" first`
    : null;

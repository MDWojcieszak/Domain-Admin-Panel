import { PhotoEntryPostStage, PhotoEntryStatus } from '@prisma/client';

/**
 * Values derived from an entry rather than stored on it
 * (docs/photo-entry-redesign.md D2, D3, §7).
 *
 * The old model stored "ACTIVE", and that is exactly why entries silently went
 * stale: nobody moved them off, even though the shoot had ended months ago. The
 * dates already knew. Nothing here is persisted.
 */

export interface HappeningWindow {
  status: PhotoEntryStatus;
  startDate: Date | null;
  endDate: Date | null;
}

/**
 * Is the shoot happening right now?
 *
 * Includes PLANNED on purpose: an entry planned for today is happening today
 * whether or not anyone flipped its status — that is the whole point of
 * deriving this instead of storing it.
 */
export const isHappeningNow = (
  entry: HappeningWindow,
  now: Date = new Date(),
): boolean => {
  if (entry.status === PhotoEntryStatus.CANCELLED) return false;
  if (!entry.startDate) return false;

  // A single-day entry has no endDate; the window is then that one day's start.
  const end = entry.endDate ?? entry.startDate;

  return (
    entry.startDate.getTime() <= now.getTime() && now.getTime() <= end.getTime()
  );
};

/**
 * Has any post-processing been done? This is the "was edited" label from D3 —
 * derived, not a column.
 */
export const wasTouched = (postStage: PhotoEntryPostStage): boolean =>
  postStage !== PhotoEntryPostStage.NONE;

/**
 * Whether entering this stage should stamp `firstEditedAt` (P2).
 *
 * FINISHED counts: jumping straight from NONE to FINISHED still means the
 * material was worked on, just not through the panel step by step.
 */
export const shouldStampFirstEdited = (
  nextStage: PhotoEntryPostStage,
  currentFirstEditedAt: Date | null,
): boolean => currentFirstEditedAt === null && wasTouched(nextStage);

/**
 * How much is left to edit (§7). Null when either count is unknown — an unknown
 * count must never read as zero, because "nothing left" and "no idea" are
 * different answers.
 */
export const remainingToEdit = (
  selectedCount: number | null,
  editedCount: number | null,
): number | null => {
  if (selectedCount === null || editedCount === null) return null;

  return Math.max(0, selectedCount - editedCount);
};

export interface ProgressCounts {
  photoCount: number | null;
  selectedCount: number | null;
  editedCount: number | null;
}

/**
 * P7 — edited ≤ selected ≤ total. Returns the reason the set is invalid, or null.
 *
 * Only known pairs are compared: an unknown count constrains nothing, which is
 * what lets the counts be filled in one at a time.
 */
export const progressViolation = (counts: ProgressCounts): string | null => {
  const { photoCount, selectedCount, editedCount } = counts;

  if (
    selectedCount !== null &&
    photoCount !== null &&
    selectedCount > photoCount
  ) {
    return `selectedCount (${selectedCount}) cannot exceed photoCount (${photoCount}).`;
  }

  if (
    editedCount !== null &&
    selectedCount !== null &&
    editedCount > selectedCount
  ) {
    return `editedCount (${editedCount}) cannot exceed selectedCount (${selectedCount}).`;
  }

  // Catches the transitive case while selectedCount is still unknown.
  if (
    editedCount !== null &&
    selectedCount === null &&
    photoCount !== null &&
    editedCount > photoCount
  ) {
    return `editedCount (${editedCount}) cannot exceed photoCount (${photoCount}).`;
  }

  return null;
};

/**
 * P1 — post-processing implies the shoot happened. Returns the reason it is
 * invalid, or null when the pair is fine.
 */
export const postStageConflict = (
  status: PhotoEntryStatus,
  postStage: PhotoEntryPostStage,
): string | null => {
  if (status !== PhotoEntryStatus.PLANNED) return null;
  if (!wasTouched(postStage)) return null;

  return (
    `An entry that has not happened cannot be in post-processing ` +
    `(status PLANNED, postStage ${postStage}). Set the status to SHOT first.`
  );
};

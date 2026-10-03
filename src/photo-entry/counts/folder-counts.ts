import { PhotoEntryCountsSource } from '@prisma/client';

import { progressViolation } from '../photo-entry-derived';

/**
 * Progress counts read from the entry folders (docs/photo-entry-redesign.md
 * §7, phase 6). The folder structure already encodes "which are selected" —
 * a file in SELECTS is selected — so the counts are a snapshot of it, never
 * per-photo state. Pure, so every counting rule is tested without a disk.
 */

/**
 * What counts as a photo. A whitelist rather than a sidecar blacklist: an
 * unknown editor's sidecar (.xmp, .pp3, .dop, .on1, .aae, …) must never
 * inflate the count, while a missed photo format merely undercounts.
 */
export const PHOTO_EXTENSIONS: ReadonlySet<string> = new Set([
  // raw
  'raf', 'cr2', 'cr3', 'crw', 'nef', 'nrw', 'arw', 'srf', 'sr2', 'dng', 'orf',
  'rw2', 'pef', 'srw', '3fr', 'fff', 'iiq', 'x3f', 'gpr', 'erf', 'mef', 'mos',
  'kdc', 'rwl',
  // rendered
  'jpg', 'jpeg', 'jpe', 'jfif', 'heic', 'heif', 'hif', 'tif', 'tiff', 'png', 'webp', 'avif',
  'jxl', 'psd', 'psb',
]); // prettier-ignore

/**
 * Directories never descended into: dot-folders (incl. ZFS `.zfs` snapshots),
 * NAS thumbnail caches and recycle bins, and editor catalog folders.
 */
export const isIgnoredDir = (name: string): boolean =>
  name.startsWith('.') ||
  name.startsWith('@') || // Synology @eaDir
  name.startsWith('#') || // #recycle, #snapshot
  name === '$RECYCLE.BIN' ||
  name === 'CaptureOne' ||
  name === 'Lightroom Previews.lrdata';

export const isPhotoFile = (name: string): boolean => {
  if (name.startsWith('.')) return false; // macOS ._ resource forks
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return false;
  return PHOTO_EXTENSIONS.has(name.slice(dot + 1).toLowerCase());
};

/**
 * One frame, however many files it is stored as. RAW+JPEG shooting writes
 * two files per frame, so the key drops the extension. The relative folder
 * stays in the key: two bodies with the same naming scheme (DSCF0001 from a
 * GFX and an X-T5) live in different folders and are different frames.
 */
export const frameKey = (
  relativePath: string,
  stripPrefixes: string[] = [],
) => {
  let path = relativePath.replace(/\\/g, '/');
  for (const prefix of stripPrefixes) {
    if (path.startsWith(`${prefix}/`)) {
      path = path.slice(prefix.length + 1);
      break;
    }
  }
  const dot = path.lastIndexOf('.');
  return (
    dot > path.lastIndexOf('/') ? path.slice(0, dot) : path
  ).toLowerCase();
};

/** Null when the folder does not exist: unknown, which is not zero. */
export const countFrames = (
  relativePaths: string[] | null,
  stripPrefixes: string[] = [],
): number | null => {
  if (relativePaths === null) return null;
  return new Set(
    relativePaths
      .filter((p) => isPhotoFile(p.split(/[\\/]/).pop()!))
      .map((p) => frameKey(p, stripPrefixes)),
  ).size;
};

/** Last segment of a path, whichever separator it uses. */
const fileName = (path: string): string => path.split(/[\\/]/).pop()!;

const stemOf = (path: string): string => {
  const name = fileName(path);
  const dot = name.lastIndexOf('.');
  return (dot > 0 ? name.slice(0, dot) : name).toLowerCase();
};

/** "dscf0412" names "dscf0412", "dscf0412_web", "dscf0412-2048px" — not "dscf04120". */
const isVariantOf = (exportStem: string, frameStem: string): boolean =>
  exportStem === frameStem ||
  (exportStem.startsWith(frameStem) &&
    /[^a-z0-9]/.test(exportStem[frameStem.length]));

/**
 * Edited frames, counted from the stage BEFORE the export rather than from the
 * export itself: one frame is often exported several times (web/ and print/
 * folders, _web / -2048px suffixes), and counting files would make "edited"
 * exceed "selected" — which reads as a skipped selection and wipes a correct
 * selectedCount.
 *
 * A frame of `basePaths` (SELECTS, or SOURCE when nothing was selected) counts
 * as edited when any export file name is a variant of it. When no export
 * matches at all — files renamed on export — it falls back to distinct export
 * names, ignoring folders, so a size per subfolder still counts once.
 */
export const countEditedFrames = (
  exportPaths: string[] | null,
  basePaths: string[] | null,
): number | null => {
  if (exportPaths === null) return null;
  const exportStems = [
    ...new Set(exportPaths.filter((p) => isPhotoFile(fileName(p))).map(stemOf)),
  ];
  if (exportStems.length === 0) return 0;

  const frameStems = new Set(
    (basePaths ?? []).filter((p) => isPhotoFile(fileName(p))).map(stemOf),
  );
  let edited = 0;
  for (const frame of frameStems) {
    if (exportStems.some((e) => isVariantOf(e, frame))) edited++;
  }
  return edited > 0 ? edited : exportStems.length;
};

export interface ProgressCounts {
  photoCount: number | null;
  selectedCount: number | null;
  editedCount: number | null;
}

/**
 * P7 for numbers read off a disk. A stage holding fewer frames than the stage
 * after it means that stage was skipped or emptied (exported straight from
 * the source, source moved elsewhere) — its count cannot be the truth, so it
 * is reported as unknown rather than as a wrong number.
 */
export const reconcileCounts = (counts: ProgressCounts): ProgressCounts => {
  let { photoCount, selectedCount } = counts;
  const { editedCount } = counts;

  if (
    selectedCount !== null &&
    editedCount !== null &&
    selectedCount < editedCount
  )
    selectedCount = null;

  const below = selectedCount ?? editedCount;
  if (photoCount !== null && below !== null && photoCount < below)
    photoCount = null;

  const reconciled = { photoCount, selectedCount, editedCount };
  // Belt and braces: whatever survives must satisfy the same rule as a
  // reported count.
  if (progressViolation(reconciled)) {
    throw new Error(
      `Reconciled counts still violate P7: ${JSON.stringify(reconciled)}`,
    );
  }
  return reconciled;
};

export interface CountsProvenance {
  countsSource: PhotoEntryCountsSource | null;
  countsUpdatedAt: Date | null;
}

/**
 * Whether an AUTOMATIC scan may overwrite the stored counts. The newer fact
 * wins: counts reported (by hand or by the culling app) after the folders
 * last changed describe the current state better than the folders do. Once
 * the folders change again, the scan takes over.
 *
 * An explicit refresh by the user always applies and does not ask this.
 */
export const scanMayOverwrite = (
  stored: CountsProvenance,
  foldersChangedAt: Date | null,
): boolean => {
  if (stored.countsSource !== PhotoEntryCountsSource.REPORTED) return true;
  if (!stored.countsUpdatedAt) return true;
  if (!foldersChangedAt) return false;
  return foldersChangedAt.getTime() > stored.countsUpdatedAt.getTime();
};

export const sameCounts = (a: ProgressCounts, b: ProgressCounts): boolean =>
  a.photoCount === b.photoCount &&
  a.selectedCount === b.selectedCount &&
  a.editedCount === b.editedCount;

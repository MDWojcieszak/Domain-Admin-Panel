import { createHash, createHmac, timingSafeEqual } from 'crypto';
import { isAbsolute, relative, sep } from 'path';
import { PublicationStatus } from '@prisma/client';

import { PHOTO_EXTENSIONS } from '../counts/folder-counts';

/**
 * Rules for publishing from an entry's export folder
 * (docs/photo-entry-planning-and-publish.md §2). Pure, so every security and
 * status rule is tested without a disk.
 */

export type ExportFormat = 'jpeg' | 'png' | 'tiff' | 'webp' | 'avif' | 'heif';

const RENDERED: Record<string, ExportFormat> = {
  jpg: 'jpeg',
  jpeg: 'jpeg',
  png: 'png',
  tif: 'tiff',
  tiff: 'tiff',
  webp: 'webp',
  avif: 'avif',
  heic: 'heif',
  heif: 'heif',
  hif: 'heif',
};

/**
 * Formats sharp can decode here. HEIF/HEIC needs an HEVC decoder that the
 * prebuilt libvips does not ship (patents), so those exports are listed but
 * cannot be previewed or published — said plainly rather than failing later.
 */
const DECODABLE: ReadonlySet<ExportFormat> = new Set([
  'jpeg',
  'png',
  'tiff',
  'webp',
  'avif',
]);

export interface ExportFileKind {
  format: ExportFormat | 'raw' | null;
  publishable: boolean;
  /** Why it cannot be published, when it cannot. */
  reason: string | null;
}

export const classifyExportFile = (name: string): ExportFileKind | null => {
  if (name.startsWith('.')) return null;
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
  const format = RENDERED[ext];
  if (format) {
    return DECODABLE.has(format)
      ? { format, publishable: true, reason: null }
      : {
          format,
          publishable: false,
          reason: 'HEIC/HEIF cannot be decoded on the server — export as JPEG',
        };
  }
  // A raw file in the export folder is listed so it does not vanish silently,
  // but a gallery serves rendered images only.
  if (PHOTO_EXTENSIONS.has(ext)) {
    return {
      format: 'raw',
      publishable: false,
      reason: 'RAW files cannot go to the gallery — export a rendered file',
    };
  }
  return null; // sidecars, videos, documents: not shown at all
};

/** JPEG goes in as is; everything else is converted at publication (D3). */
export const needsConversion = (format: ExportFormat): boolean =>
  format !== 'jpeg';

// ----------------------------------------------------------------- keys (Q2)

/**
 * Opaque, stateless key for a file inside the export folder. The client only
 * ever echoes it back; it never sends a path (Q2).
 */
export const encodeKey = (relativePath: string): string =>
  Buffer.from(relativePath, 'utf8').toString('base64url');

/** Null for anything that is not a plain relative path below the folder. */
export const decodeKey = (key: string): string | null => {
  if (!/^[A-Za-z0-9_-]+$/.test(key)) return null;
  const path = Buffer.from(key, 'base64url').toString('utf8');
  if (
    !path ||
    path.includes('\0') ||
    path.includes('\\') ||
    path.startsWith('/') ||
    /^[A-Za-z]:/.test(path) ||
    path.split('/').some((seg) => seg === '' || seg === '.' || seg === '..')
  ) {
    return null;
  }
  return path;
};

/** Is `candidate` (already realpath-resolved) strictly inside `root`? */
export const isInside = (root: string, candidate: string): boolean => {
  const rel = relative(root, candidate);
  return (
    !!rel && !rel.startsWith(`..${sep}`) && rel !== '..' && !isAbsolute(rel)
  );
};

// ----------------------------------------------------------- signatures (Q3)

export enum PreviewSize {
  THUMB = 'thumb',
  PREVIEW = 'preview',
}

export const PREVIEW_PIXELS: Record<PreviewSize, number> = {
  [PreviewSize.THUMB]: 480,
  [PreviewSize.PREVIEW]: 1600,
};

/** One hour: long enough for a session of picking, short enough to leak little. */
export const PREVIEW_URL_TTL_SECONDS = 60 * 60;

const payload = (
  entryId: string,
  key: string,
  size: PreviewSize,
  exp: number,
) => `${entryId}\n${key}\n${size}\n${exp}`;

export const signPreview = (
  secret: string,
  entryId: string,
  key: string,
  size: PreviewSize,
  exp: number,
): string =>
  createHmac('sha256', secret)
    .update(payload(entryId, key, size, exp))
    .digest('base64url');

/** Constant-time check of signature and expiry (Q3). */
export const verifyPreview = (
  secret: string,
  args: {
    entryId: string;
    key: string;
    size: PreviewSize;
    exp: number;
    sig: string;
  },
  nowSeconds: number = Math.floor(Date.now() / 1000),
): boolean => {
  if (!Number.isFinite(args.exp) || args.exp < nowSeconds) return false;
  const expected = Buffer.from(
    signPreview(secret, args.entryId, args.key, args.size, args.exp),
  );
  const given = Buffer.from(args.sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

/**
 * Derives the preview-signing key from the app secret, so a preview signature
 * can never double as anything else signed with that secret.
 */
export const derivePreviewSecret = (appSecret: string): string =>
  createHmac('sha256', appSecret)
    .update('photo-entry-export-preview')
    .digest('hex');

export const previewUrl = (
  secret: string,
  entryId: string,
  key: string,
  size: PreviewSize,
  exp: number,
): string =>
  `/photo-entry/${entryId}/exports/preview?key=${key}&size=${size}&exp=${exp}` +
  `&sig=${signPreview(secret, entryId, key, size, exp)}`;

/**
 * Cache file name. Size and mtime are part of it, so a re-export can never
 * be served a stale preview — it simply gets a new file.
 */
export const previewCacheName = (
  entryId: string,
  relativePath: string,
  fileSize: number,
  mtimeMs: number,
  size: PreviewSize,
): string =>
  createHash('sha1')
    .update(
      `${entryId}\n${relativePath}\n${fileSize}\n${Math.floor(mtimeMs)}\n${size}`,
    )
    .digest('hex') + '.webp';

// ------------------------------------------------------------------ status

export enum ExportFileStatus {
  NEW = 'NEW',
  PENDING = 'PENDING',
  PUBLISHED = 'PUBLISHED',
  /** Published, but the file changed on disk since — a re-export. */
  CHANGED = 'CHANGED',
  FAILED = 'FAILED',
}

export interface PublicationState {
  status: PublicationStatus;
  imageId: string | null;
  sourceSize: bigint | number | null;
  sourceMtime: Date | null;
}

/** NEW and CHANGED are derived, never stored (§2.6). */
export const exportFileStatus = (
  row: PublicationState | null,
  file: { size: number; mtime: Date },
): ExportFileStatus => {
  if (!row) return ExportFileStatus.NEW;
  if (row.status === PublicationStatus.PENDING) return ExportFileStatus.PENDING;
  if (row.status === PublicationStatus.FAILED) return ExportFileStatus.FAILED;
  // The image was deleted from the library: the file is unpublished again.
  if (!row.imageId) return ExportFileStatus.NEW;
  const changed =
    Number(row.sourceSize) !== file.size ||
    Math.floor(row.sourceMtime?.getTime() ?? 0) !==
      Math.floor(file.mtime.getTime());
  return changed ? ExportFileStatus.CHANGED : ExportFileStatus.PUBLISHED;
};

/** Q4 — what a publish request does with a file in each state. */
export const publishAction = (
  status: ExportFileStatus,
  hasImage: boolean,
): 'upload' | 'replace' | 'skip' => {
  switch (status) {
    case ExportFileStatus.NEW:
      return 'upload';
    // A failed REPLACE still owns its image: retrying must replace again, or
    // the retry would create the duplicate Q4 forbids.
    case ExportFileStatus.FAILED:
      return hasImage ? 'replace' : 'upload';
    case ExportFileStatus.CHANGED:
      return 'replace';
    case ExportFileStatus.PUBLISHED:
    case ExportFileStatus.PENDING:
      return 'skip';
  }
};

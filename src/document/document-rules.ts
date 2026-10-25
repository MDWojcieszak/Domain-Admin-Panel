import { createHmac, timingSafeEqual } from 'crypto';
import { DocumentKind } from '@prisma/client';

/**
 * Rules for the document library (docs/projects-design.md §4, D9). Pure, so
 * classification and URL signing are tested without a disk.
 */

/** How many leading bytes classification looks at. */
export const SNIFF_BYTES = 4096;

/** Lower-case letters and digits only, or nothing: the stored name is <id>.<ext>. */
export const sanitizeExtension = (originalName: string): string | null => {
  // Of the last path segment only: a name is never a path.
  const base = originalName.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  if (dot <= 0 || dot === base.length - 1) return null;
  const ext = base
    .slice(dot + 1)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return ext && ext.length <= 10 ? ext : null;
};

const MODEL_3D = new Set([
  'stl',
  'obj',
  '3mf',
  'step',
  'stp',
  'glb',
  'gltf',
  'ply',
  'iges',
  'igs',
]);
const CAD = new Set([
  'f3d',
  'f3z',
  'dxf',
  'dwg',
  'skp',
  'fcstd',
  'scad',
  'sldprt',
  'sldasm',
]);
const ARCHIVE = new Set(['zip', '7z', 'rar', 'gz', 'tgz', 'tar', 'bz2', 'xz']);
const TEXT = new Set([
  'txt',
  'md',
  'csv',
  'json',
  'yaml',
  'yml',
  'log',
  'ini',
  'toml',
  'gcode',
  'nc',
  'ino',
  'py',
  'c',
  'h',
  'cpp',
]);

type Signature = { mime: string; kind: DocumentKind };

const startsWith = (bytes: Buffer, magic: number[], offset = 0) =>
  bytes.length >= offset + magic.length &&
  magic.every((b, i) => bytes[offset + i] === b);

const ascii = (bytes: Buffer, from: number, to: number) =>
  bytes.subarray(from, to).toString('latin1');

/** What the bytes say, regardless of the name. Only formats served inline need to be here. */
const sniff = (bytes: Buffer): Signature | null => {
  if (startsWith(bytes, [0xff, 0xd8, 0xff]))
    return { mime: 'image/jpeg', kind: 'IMAGE' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: 'image/png', kind: 'IMAGE' };
  if (ascii(bytes, 0, 6) === 'GIF87a' || ascii(bytes, 0, 6) === 'GIF89a')
    return { mime: 'image/gif', kind: 'IMAGE' };
  if (ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP')
    return { mime: 'image/webp', kind: 'IMAGE' };
  if (
    startsWith(bytes, [0x49, 0x49, 0x2a, 0x00]) ||
    startsWith(bytes, [0x4d, 0x4d, 0x00, 0x2a])
  )
    return { mime: 'image/tiff', kind: 'IMAGE' };
  if (
    ascii(bytes, 4, 8) === 'ftyp' &&
    ['avif', 'avis'].includes(ascii(bytes, 8, 12))
  )
    return { mime: 'image/avif', kind: 'IMAGE' };
  if (ascii(bytes, 0, 5) === '%PDF-')
    return { mime: 'application/pdf', kind: 'PDF' };
  if (ascii(bytes, 0, 4) === 'glTF')
    return { mime: 'model/gltf-binary', kind: 'MODEL_3D' };
  if (startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]))
    return { mime: 'application/zip', kind: 'ARCHIVE' };
  if (startsWith(bytes, [0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]))
    return { mime: 'application/x-7z-compressed', kind: 'ARCHIVE' };
  if (ascii(bytes, 0, 4) === 'Rar!')
    return { mime: 'application/vnd.rar', kind: 'ARCHIVE' };
  if (startsWith(bytes, [0x1f, 0x8b]))
    return { mime: 'application/gzip', kind: 'ARCHIVE' };
  return null;
};

/** No NUL bytes and mostly printable: good enough to call it text. */
const looksLikeText = (bytes: Buffer) => {
  if (!bytes.length) return false;
  let printable = 0;
  for (const b of bytes) {
    if (b === 0) return false;
    if (b === 9 || b === 10 || b === 13 || b >= 32) printable++;
  }
  return printable / bytes.length > 0.95;
};

export interface Classification {
  kind: DocumentKind;
  /** Verified for images, PDFs and archives; otherwise a safe generic type. */
  mimeType: string;
  extension: string | null;
}

/**
 * The kind from the file's signature first and its extension second. The
 * client's Content-Type is never trusted: a "PNG" that is really HTML is
 * classified by what it is, so it can never be served inline.
 */
export const classifyDocument = (
  head: Buffer,
  originalName: string,
): Classification => {
  const extension = sanitizeExtension(originalName);
  const signed = sniff(head);

  // Containers that are something more specific: a 3MF or an F3D is a zip.
  if (extension && (MODEL_3D.has(extension) || CAD.has(extension))) {
    const kind: DocumentKind = MODEL_3D.has(extension) ? 'MODEL_3D' : 'CAD';
    return {
      kind,
      mimeType:
        signed?.kind === 'MODEL_3D' ? signed.mime : 'application/octet-stream',
      extension,
    };
  }
  if (signed) return { kind: signed.kind, mimeType: signed.mime, extension };
  if (extension && ARCHIVE.has(extension))
    return { kind: 'ARCHIVE', mimeType: 'application/octet-stream', extension };
  if ((extension && TEXT.has(extension)) || looksLikeText(head))
    return { kind: 'TEXT', mimeType: 'text/plain; charset=utf-8', extension };
  return { kind: 'OTHER', mimeType: 'application/octet-stream', extension };
};

/**
 * Shown in the browser only when the bytes were verified as a raster image or
 * a PDF; everything else downloads. SVG and HTML never render from here.
 */
export const isInlineSafe = (kind: DocumentKind, mimeType: string) =>
  (kind === 'IMAGE' && mimeType.startsWith('image/')) ||
  (kind === 'PDF' && mimeType === 'application/pdf');

/** A title from the file name: "mount_drawing-revB.pdf" → "mount drawing revB". */
export const titleFromName = (originalName: string) => {
  const dot = originalName.lastIndexOf('.');
  const base = dot > 0 ? originalName.slice(0, dot) : originalName;
  return (
    base.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200) ||
    'Document'
  );
};

/** RFC 5987 Content-Disposition, so Polish names survive the download. */
export const contentDisposition = (
  type: 'inline' | 'attachment',
  originalName: string,
) => {
  const fallback = originalName
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  return `${type}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(originalName)}`;
};

// ------------------------------------------------------------ signed URLs (D9)

export type DocumentVariant = 'original' | 'thumb' | 'large';
export const DOCUMENT_VARIANTS: DocumentVariant[] = [
  'original',
  'thumb',
  'large',
];

/** Preview widths; never upscaled. */
export const PREVIEW_WIDTH: Record<
  Exclude<DocumentVariant, 'original'>,
  number
> = {
  thumb: 480,
  large: 1920,
};

/** Its own key, so a document signature can never double as anything else. */
export const deriveDocumentSecret = (appSecret: string) =>
  createHmac('sha256', appSecret).update('project-documents').digest('hex');

export const signDocument = (
  secret: string,
  id: string,
  variant: DocumentVariant,
  exp: number,
) =>
  createHmac('sha256', secret)
    .update(`${id}\n${variant}\n${exp}`)
    .digest('base64url');

export const verifyDocument = (
  secret: string,
  args: { id: string; variant: DocumentVariant; exp: number; sig: string },
  nowSeconds = Math.floor(Date.now() / 1000),
) => {
  if (!Number.isFinite(args.exp) || args.exp < nowSeconds) return false;
  const expected = Buffer.from(
    signDocument(secret, args.id, args.variant, args.exp),
  );
  const given = Buffer.from(args.sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
};

/**
 * Expiry on a half-hour grid, an hour or more ahead: the same URL for half an
 * hour, so the browser's cache works, and never valid for more than 90 minutes.
 */
export const documentUrlExpiry = (nowSeconds = Math.floor(Date.now() / 1000)) =>
  Math.floor(nowSeconds / 1800) * 1800 + 3600 + 1800;

// ------------------------------------------------------------- upkeep

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const ORIGINAL_FILE = new RegExp(`^(${UUID})(?:[.][a-z0-9]{1,10})?$`);
const PREVIEW_FILE = new RegExp(`^(${UUID})-(?:thumb|large)[.]webp$`);

/**
 * Which document a stored file belongs to, from its name; null for anything
 * the library did not write, which upkeep then leaves alone.
 */
export const documentIdFromFile = (
  folder: 'original' | 'preview',
  name: string,
): string | null =>
  (folder === 'original' ? ORIGINAL_FILE : PREVIEW_FILE).exec(name)?.[1] ??
  null;

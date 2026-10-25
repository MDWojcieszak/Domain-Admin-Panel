import { join } from 'path';

import { DocumentVariant } from './document-rules';

/**
 * Where documents live on disk. Read from the environment at load time, since
 * the upload interceptor needs it before any provider exists.
 */
export const DOCUMENT_ROOT =
  process.env.DOCUMENT_STORAGE_PATH || '/app/public/document';

/** 200 MB unless DOCUMENT_MAX_MB says otherwise: models and PDFs run large. */
export const DOCUMENT_MAX_BYTES =
  Math.max(1, Number(process.env.DOCUMENT_MAX_MB) || 200) * 1024 * 1024;

/** Uploads stream here first, then move into place once classified. */
export const DOCUMENT_TMP_DIR = join(DOCUMENT_ROOT, 'tmp');

export const documentPath = (
  id: string,
  extension: string | null,
  variant: DocumentVariant,
) =>
  variant === 'original'
    ? join(DOCUMENT_ROOT, 'original', extension ? `${id}.${extension}` : id)
    : join(DOCUMENT_ROOT, 'preview', `${id}-${variant}.webp`);

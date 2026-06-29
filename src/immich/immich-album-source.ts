import { ImmichAlbumSource } from '@prisma/client';

/**
 * Maps an album source scope to the entry sub-folder its assets live in.
 * `null` means the whole entry (every sub-folder) is used.
 *
 * Sub-folders match the structure created by PhotoStorageService
 * (01_SOURCE / 02_SELECTS / 03_EDIT / 04_EXPORT / 05_DELIVERY).
 */
export const ALBUM_SOURCE_SUBFOLDER: Record<ImmichAlbumSource, string | null> =
  {
    [ImmichAlbumSource.EXPORT]: '04_EXPORT',
    [ImmichAlbumSource.EDIT]: '03_EDIT',
    [ImmichAlbumSource.SELECTS]: '02_SELECTS',
    [ImmichAlbumSource.SOURCE]: '01_SOURCE',
    [ImmichAlbumSource.DELIVERY]: '05_DELIVERY',
    [ImmichAlbumSource.ENTIRE]: null,
  };

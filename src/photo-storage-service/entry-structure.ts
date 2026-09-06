/**
 * Semantic role of a folder inside a photo entry.
 *
 * External integrations should key off the **role**, never the literal path:
 * the numbered prefixes (`01_`, `02_`, …) exist only to force a sane sort order
 * in a file browser and may be renumbered. Roles are the stable contract.
 */
export enum PhotoEntryFolderRole {
  SOURCE = 'SOURCE',
  SOURCE_RAW = 'SOURCE_RAW',
  SOURCE_JPEG = 'SOURCE_JPEG',
  SOURCE_VIDEO = 'SOURCE_VIDEO',
  SOURCE_SEQUENCES = 'SOURCE_SEQUENCES',
  SOURCE_LIGHTS = 'SOURCE_LIGHTS',
  SOURCE_DARKS = 'SOURCE_DARKS',
  SOURCE_FLATS = 'SOURCE_FLATS',
  SOURCE_BIASES = 'SOURCE_BIASES',
  SOURCE_REJECTED = 'SOURCE_REJECTED',
  SELECTS = 'SELECTS',
  WORKSPACE = 'WORKSPACE',
  EDIT = 'EDIT',
  EXPORT = 'EXPORT',
  DELIVERY = 'DELIVERY',
}

export type EntryStructureType = 'general' | 'work' | 'astro';

/** One directory to create, relative to the entry's root folder. */
export interface PhotoEntryFolder {
  path: string;
  role: PhotoEntryFolderRole;
}

/**
 * The single source of truth for an entry's on-disk layout. `PhotoStorageService`
 * creates exactly these directories, and the public folder-structure endpoint
 * serves exactly this list — so an external app that mirrors the response can
 * never drift from what the backend itself produces.
 */
export const ENTRY_STRUCTURES: Record<
  EntryStructureType,
  readonly PhotoEntryFolder[]
> = {
  general: [
    { path: '01_SOURCE', role: PhotoEntryFolderRole.SOURCE },
    { path: '01_SOURCE/RAW', role: PhotoEntryFolderRole.SOURCE_RAW },
    { path: '01_SOURCE/JPEG', role: PhotoEntryFolderRole.SOURCE_JPEG },
    { path: '01_SOURCE/VIDEO', role: PhotoEntryFolderRole.SOURCE_VIDEO },
    {
      path: '01_SOURCE/SEQUENCES',
      role: PhotoEntryFolderRole.SOURCE_SEQUENCES,
    },
    { path: '02_SELECTS', role: PhotoEntryFolderRole.SELECTS },
    { path: '03_EDIT', role: PhotoEntryFolderRole.EDIT },
    { path: '04_EXPORT', role: PhotoEntryFolderRole.EXPORT },
  ],

  // Same as general, plus a hand-off folder for whatever the client receives.
  work: [
    { path: '01_SOURCE', role: PhotoEntryFolderRole.SOURCE },
    { path: '01_SOURCE/RAW', role: PhotoEntryFolderRole.SOURCE_RAW },
    { path: '01_SOURCE/JPEG', role: PhotoEntryFolderRole.SOURCE_JPEG },
    { path: '01_SOURCE/VIDEO', role: PhotoEntryFolderRole.SOURCE_VIDEO },
    {
      path: '01_SOURCE/SEQUENCES',
      role: PhotoEntryFolderRole.SOURCE_SEQUENCES,
    },
    { path: '02_SELECTS', role: PhotoEntryFolderRole.SELECTS },
    { path: '03_EDIT', role: PhotoEntryFolderRole.EDIT },
    { path: '04_EXPORT', role: PhotoEntryFolderRole.EXPORT },
    { path: '05_DELIVERY', role: PhotoEntryFolderRole.DELIVERY },
  ],

  // Astro splits the source by calibration frame type and stacks in a workspace
  // instead of a single edit folder.
  astro: [
    { path: '01_SOURCE', role: PhotoEntryFolderRole.SOURCE },
    { path: '01_SOURCE/LIGHTS', role: PhotoEntryFolderRole.SOURCE_LIGHTS },
    { path: '01_SOURCE/DARKS', role: PhotoEntryFolderRole.SOURCE_DARKS },
    { path: '01_SOURCE/FLATS', role: PhotoEntryFolderRole.SOURCE_FLATS },
    { path: '01_SOURCE/BIASES', role: PhotoEntryFolderRole.SOURCE_BIASES },
    { path: '01_SOURCE/REJECTED', role: PhotoEntryFolderRole.SOURCE_REJECTED },
    { path: '02_WORKSPACE', role: PhotoEntryFolderRole.WORKSPACE },
    { path: '04_EXPORT', role: PhotoEntryFolderRole.EXPORT },
  ],
};

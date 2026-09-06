import { PhotoEntryType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';

import { PhotoEntryFolderResponse } from './photo-entry-folder.response';

export class PhotoEntryFolderStructureResponse {
  @IsString()
  id: string;

  /** Human name of the entry, as typed by the user. */
  @IsString()
  name: string;

  @IsEnum({ enum: { PhotoEntryType } })
  type: PhotoEntryType;

  /**
   * The entry's own folder — the last segment of `rootPath`, derived from the
   * name and dates (e.g. `2026_05_01__02D____SLUB_ANI_I_PIOTRA`).
   */
  @IsString()
  folderName: string;

  /**
   * Where the entry folder lives relative to the photo library root, e.g.
   * `WORK/2026/<folderName>` or `2026/<folderName>` for general entries.
   */
  @IsString()
  rootPath: string;

  /**
   * `false` means `rootPath` / `folderName` are a *prediction* — the backend has
   * not created anything yet and the values are recomputed on every call. They
   * become fixed once `POST /photo-entry/{id}/create-folders` has run, which is
   * also when the entry's name and dates stop being editable.
   */
  @IsBoolean()
  foldersCreated: boolean;

  /** Sub-folders to create under `rootPath`, parents before children. */
  @IsNested({ type: PhotoEntryFolderResponse, isArray: true })
  folders: PhotoEntryFolderResponse[];
}

import { IsEnum, IsString } from 'nestjs-swagger-dto';

import { PhotoEntryFolderRole } from '../../photo-storage-service/entry-structure';

export class PhotoEntryFolderResponse {
  /** Relative to the entry root, forward slashes, no leading slash. */
  @IsString()
  path: string;

  /** Stable identifier — match on this rather than on `path`. */
  @IsEnum({ enum: { PhotoEntryFolderRole } })
  role: PhotoEntryFolderRole;
}

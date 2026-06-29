import { ImmichAlbumSource } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class AttachEntryDto {
  @IsString()
  photoEntryId: string;

  /**
   * Which folder scope of the entry to push into the album. Defaults to EXPORT.
   */
  @IsEnum({ enum: { ImmichAlbumSource }, optional: true })
  source?: ImmichAlbumSource;

  /** Optional: scope to a single astro object of the entry. */
  @IsString({ optional: true })
  astroObjectId?: string;
}

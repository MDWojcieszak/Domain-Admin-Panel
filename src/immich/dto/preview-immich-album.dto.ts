import { ImmichAlbumSource } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class PreviewImmichAlbumDto {
  @IsString()
  photoEntryId: string;

  /**
   * Which folder scope to preview. Defaults to EXPORT (04_EXPORT).
   */
  @IsEnum({ enum: { ImmichAlbumSource }, optional: true })
  source?: ImmichAlbumSource;

  /** Optional: scope to a single astro object of the entry. */
  @IsString({ optional: true })
  astroObjectId?: string;
}

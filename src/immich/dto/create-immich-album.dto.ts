import { ImmichAlbumSource } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class CreateImmichAlbumDto {
  @IsString()
  photoEntryId: string;

  /**
   * Which folder scope the album is built from. Defaults to EXPORT
   * (the 04_EXPORT folder with the final, exported photos).
   */
  @IsEnum({ enum: { ImmichAlbumSource }, optional: true })
  source?: ImmichAlbumSource;

  /**
   * Optional: scope to a single astro object of the entry (only its folder is
   * used). Omit to use the whole entry (root + all astro objects).
   */
  @IsString({ optional: true })
  astroObjectId?: string;

  /**
   * Optional album name override. Defaults to the photo entry name.
   */
  @IsString({ maxLength: 200, optional: true })
  albumName?: string;
}

import { IsString } from 'nestjs-swagger-dto';

export class GetImmichAlbumsQueryDto {
  /**
   * Filter albums by photo entry. When omitted, returns all of the user's
   * tracked Immich albums.
   */
  @IsString({ optional: true })
  photoEntryId?: string;
}

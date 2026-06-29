import { ImmichAlbumSource } from '@prisma/client';
import { IsDate, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

/** A tracked link: a photo entry (folder scope) contributing to an album. */
export class ImmichAlbumEntryLinkResponse {
  /** Internal link record id (use it to refresh / detach). */
  @IsString()
  id: string;

  @IsString()
  photoEntryId: string;

  @IsEnum({ enum: { ImmichAlbumSource } })
  source: ImmichAlbumSource;

  /** Set when the link is scoped to a single astro object of the entry. */
  @IsString({ optional: true, nullable: true })
  astroObjectId: string | null;

  @IsNumber({ optional: true, nullable: true })
  lastAssetCount: number | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  lastSyncedAt: Date | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;
}

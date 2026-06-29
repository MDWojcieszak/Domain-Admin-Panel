import { ImmichAlbumSource } from '@prisma/client';
import { IsDate, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class ImmichAlbumItemResponse {
  /** Internal tracking record id. */
  @IsString()
  id: string;

  @IsString()
  photoEntryId: string;

  @IsString()
  albumId: string;

  @IsString()
  albumName: string;

  /** Direct, clickable link to the album in the Immich web UI. */
  @IsString()
  albumUrl: string;

  @IsEnum({ enum: { ImmichAlbumSource } })
  source: ImmichAlbumSource;

  @IsString({ optional: true, nullable: true })
  astroObjectId: string | null;

  @IsNumber({ optional: true, nullable: true })
  lastAssetCount: number | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  lastSyncedAt: Date | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

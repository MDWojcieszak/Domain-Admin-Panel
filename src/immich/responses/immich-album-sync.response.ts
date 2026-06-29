import { ImmichAlbumSource } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';
import { ImmichAssetPreviewResponse } from './immich-asset-preview.response';

export class ImmichAlbumSyncResponse {
  /** Internal tracking record id (use it to refresh / delete this album). */
  @IsString()
  id: string;

  /** Immich album id. */
  @IsString()
  albumId: string;

  @IsString()
  albumName: string;

  /** Direct, clickable link to the album in the Immich web UI. */
  @IsString()
  albumUrl: string;

  @IsEnum({ enum: { ImmichAlbumSource } })
  source: ImmichAlbumSource;

  @IsBoolean()
  created: boolean;

  @IsNumber()
  assetsFound: number;

  @IsNumber()
  assetsAdded: number;

  @IsNumber()
  totalAlbumAssets: number;

  /**
   * Preview of the assets relevant to this op: on create — everything put in
   * the album; on refresh — only the newly added assets.
   */
  @IsNested({ type: ImmichAssetPreviewResponse, isArray: true })
  assets: ImmichAssetPreviewResponse[];
}

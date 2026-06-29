import { ImmichAlbumSource } from '@prisma/client';
import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';
import { ImmichAssetPreviewResponse } from './immich-asset-preview.response';

export class ImmichAlbumPreviewResponse {
  @IsString()
  photoEntryId: string;

  @IsEnum({ enum: { ImmichAlbumSource } })
  source: ImmichAlbumSource;

  /** Absolute Immich folder paths that were scanned. */
  @IsString({ isArray: true })
  folderPaths: string[];

  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: ImmichAssetPreviewResponse, isArray: true })
  assets: ImmichAssetPreviewResponse[];
}

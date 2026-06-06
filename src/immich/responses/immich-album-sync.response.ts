import { IsBoolean, IsNumber, IsString } from 'nestjs-swagger-dto';

export class ImmichAlbumSyncResponse {
  @IsString()
  albumId: string;

  @IsString()
  albumName: string;

  @IsBoolean()
  created: boolean;

  @IsNumber()
  assetsFound: number;

  @IsNumber()
  assetsAdded: number;

  @IsNumber()
  totalAlbumAssets: number;
}

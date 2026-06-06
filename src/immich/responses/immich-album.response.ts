import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class ImmichAlbumResponse {
  @IsString()
  id: string;

  @IsString()
  albumName: string;

  @IsNumber()
  assetCount: number;
}

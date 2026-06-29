import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { ImmichBrowseAlbumResponse } from './immich-browse-album.response';

export class ImmichAlbumBrowseResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: ImmichBrowseAlbumResponse, isArray: true })
  albums: ImmichBrowseAlbumResponse[];
}

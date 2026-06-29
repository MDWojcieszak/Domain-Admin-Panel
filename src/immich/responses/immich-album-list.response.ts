import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { ImmichAlbumItemResponse } from './immich-album-item.response';

export class ImmichAlbumListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: ImmichAlbumItemResponse, isArray: true })
  albums: ImmichAlbumItemResponse[];
}

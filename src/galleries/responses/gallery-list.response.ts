import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { GalleryResponse } from './gallery.response';

export class GalleryListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: GalleryResponse, isArray: true })
  galleries: GalleryResponse[];
}

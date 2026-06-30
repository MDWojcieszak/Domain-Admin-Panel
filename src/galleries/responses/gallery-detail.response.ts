import { IsNested } from 'nestjs-swagger-dto';
import { GalleryResponse } from './gallery.response';
import { GalleryImageItemResponse } from './gallery-image-item.response';

export class GalleryDetailResponse extends GalleryResponse {
  @IsNested({ type: GalleryImageItemResponse, isArray: true })
  items: GalleryImageItemResponse[];
}

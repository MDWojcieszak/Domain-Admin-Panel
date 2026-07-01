import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { GalleryLibraryItemResponse } from './gallery-library-item.response';

export class GalleryLibraryResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNumber({ type: 'integer' })
  take: number;

  @IsNumber({ type: 'integer' })
  skip: number;

  @IsNested({ type: GalleryLibraryItemResponse, isArray: true })
  images: GalleryLibraryItemResponse[];
}

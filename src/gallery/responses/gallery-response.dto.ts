import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { GalleryImageDto } from '../dto';

export class GalleryResponseDto {
  @IsNested({ type: GalleryImageDto, isArray: true })
  images: GalleryImageDto[];

  @IsNumber()
  count: number;
}

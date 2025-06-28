import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { ImageDto } from '../dto';

export class GalleryResponseDto {
  @IsNested({ type: ImageDto, isArray: true })
  images: ImageDto[];

  @IsNumber()
  count: number;
}

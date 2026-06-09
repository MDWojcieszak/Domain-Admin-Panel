import { IsNested, IsString } from 'nestjs-swagger-dto';
import { GalleryImageDataDto } from './image-data.dto';
import { DimensionsDto } from './dimentions.dto';
export class GalleryImageDto {
  @IsString()
  id: string;

  @IsNested({ type: GalleryImageDataDto, optional: true })
  data?: GalleryImageDataDto;

  @IsNested({ type: DimensionsDto, optional: true })
  dimensions?: DimensionsDto;
}

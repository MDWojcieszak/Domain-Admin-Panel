import { IsNested, IsString } from 'nestjs-swagger-dto';
import { ImageDataDto } from './image-data.dto';
import { DimensionsDto } from './dimentions.dto';
export class ImageDto {
  @IsString()
  id: string;

  @IsNested({ type: ImageDataDto, optional: true })
  data?: ImageDataDto;

  @IsNested({ type: DimensionsDto, optional: true })
  dimensions?: DimensionsDto;
}

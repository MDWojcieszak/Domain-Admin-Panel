import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { ImageDataResponseDto } from './image-data-responde.dto';
import { PaginationDto } from '../../common/dto';

export class ImageListResponseDto {
  @IsNested({ type: ImageDataResponseDto, isArray: true })
  images: ImageDataResponseDto[];

  @IsNumber()
  total: number;

  @IsNested({ type: PaginationDto, optional: true })
  params?: PaginationDto;
}

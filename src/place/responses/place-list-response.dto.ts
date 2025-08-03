import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { PaginationDto } from '../../common/dto';
import { PlaceDetailResponseDto } from './place-detail-response.dto';

export class PlaceListResponseDto {
  @IsNested({ type: PlaceDetailResponseDto, isArray: true })
  places: PlaceDetailResponseDto[];

  @IsNumber()
  total: number;

  @IsNested({ type: PaginationDto, optional: true })
  params?: PaginationDto;
}

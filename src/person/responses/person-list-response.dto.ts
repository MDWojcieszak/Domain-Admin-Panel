import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { PaginationDto } from '../../common/dto';
import { PersonDetailResponseDto } from './person-detail-response.dto';

export class PersonListResponseDto {
  @IsNested({ type: PersonDetailResponseDto, isArray: true })
  persons: PersonDetailResponseDto[];

  @IsNumber()
  total: number;

  @IsNested({ type: PaginationDto, optional: true })
  params?: PaginationDto;
}

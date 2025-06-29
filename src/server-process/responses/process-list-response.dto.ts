import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { PaginationDto } from '../../common/dto';
import { ProcessResponseDto } from './process-response.dto';

export class ProcessListResponseDto {
  @IsNested({ type: ProcessResponseDto, isArray: true })
  processes: ProcessResponseDto[];

  @IsNumber()
  total: number;

  @IsNested({ type: PaginationDto, optional: true })
  params?: PaginationDto;
}

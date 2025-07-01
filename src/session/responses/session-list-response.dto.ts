import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { PaginationDto } from '../../common/dto';
import { SessionResponseDto } from './session-response.dto';

export class SessionListResponseDto {
  @IsNested({ type: SessionResponseDto, isArray: true })
  sessions: SessionResponseDto[];

  @IsNumber()
  total: number;

  @IsNested({ type: PaginationDto, optional: true })
  params?: PaginationDto;
}

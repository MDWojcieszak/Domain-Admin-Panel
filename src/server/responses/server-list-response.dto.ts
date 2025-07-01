import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { PaginationDto } from '../../common/dto';
import { ServerResponseDto } from './server-response.dto';

export class ServerListResponseDto {
  @IsNested({ type: ServerResponseDto, isArray: true })
  servers: ServerResponseDto[];

  @IsNumber()
  total: number;

  @IsNested({ type: PaginationDto, optional: true })
  params?: PaginationDto;
}

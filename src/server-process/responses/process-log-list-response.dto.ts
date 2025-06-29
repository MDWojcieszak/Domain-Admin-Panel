import { ProcessLogLevel } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';
import { PaginationDto } from '../../common/dto';

class ProcessLog {
  @IsString()
  id: string;

  @IsString()
  message: string;

  @IsDate({ format: 'date-time' })
  timestamp: Date;

  @IsEnum({ enum: { ProcessLogLevel } })
  level?: ProcessLogLevel;
}

export class ProcessLogListResponseDto {
  @IsNested({ type: ProcessLog, isArray: true })
  logs: ProcessLog[];

  @IsNumber()
  total: number;

  @IsNested({ type: PaginationDto, optional: true })
  params?: PaginationDto;
}

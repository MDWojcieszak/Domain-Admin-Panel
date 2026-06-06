import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';
import {
  CommandMatchType,
  CommandRuntimeStatus,
  ProcessLogLevel,
} from '@prisma/client';

export class UpdateCommandProgressMarkerDto {
  @IsString({ optional: true })
  label?: string;

  @IsString({ optional: true })
  pattern?: string;

  @IsEnum({ enum: { CommandMatchType }, optional: true })
  matchType?: CommandMatchType;

  @IsNumber({ min: 0, max: 100, optional: true })
  progress?: number;

  @IsEnum({ enum: { CommandRuntimeStatus }, optional: true })
  runtimeStatus?: CommandRuntimeStatus;

  @IsEnum({ enum: { ProcessLogLevel }, optional: true })
  level?: ProcessLogLevel;

  @IsNumber({ min: 0, optional: true })
  order?: number;
}

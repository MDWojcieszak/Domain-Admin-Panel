import {
  CommandMatchType,
  CommandRuntimeStatus,
  ProcessLogLevel,
} from '@prisma/client';
import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CommandProgressMarkerResponseDto {
  @IsString()
  id: string;

  @IsString()
  commandId: string;

  @IsString({ optional: true })
  label?: string;

  @IsString()
  pattern: string;

  @IsEnum({ enum: { CommandMatchType } })
  matchType: CommandMatchType;

  @IsNumber({ optional: true })
  progress?: number;

  @IsEnum({ enum: { CommandRuntimeStatus }, optional: true })
  runtimeStatus?: CommandRuntimeStatus;

  @IsEnum({ enum: { ProcessLogLevel }, optional: true })
  level?: ProcessLogLevel;

  @IsNumber()
  order: number;
}

export class CommandProgressMarkerListResponseDto {
  @IsNested({ type: CommandProgressMarkerResponseDto, isArray: true })
  markers: CommandProgressMarkerResponseDto[];

  @IsNumber()
  total: number;
}

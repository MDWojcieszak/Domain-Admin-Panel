import { DiskType, ServerStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';
import { UserDto } from '../../user/dto';

export class CpuDto {
  @IsNumber({ optional: true })
  cores?: number;

  @IsNumber({ optional: true })
  physicalCores?: number;

  @IsNumber()
  currentLoad: number;

  @IsNumber()
  currentLoadUser: number;

  @IsNumber()
  currentLoadSystem: number;
}

export class MemoryDto {
  @IsNumber({ optional: true })
  total?: bigint;

  @IsNumber({ optional: true })
  free?: bigint;
}

export class DiskInfoDto {
  @IsString({ optional: true })
  fs?: string;

  @IsString({ optional: true })
  type?: string;

  @IsNumber({ optional: true })
  used?: bigint;

  @IsNumber({ optional: true })
  available?: bigint;

  @IsString({ optional: true })
  name?: string;

  @IsEnum({ enum: { DiskType }, optional: true })
  mediaType?: DiskType;
}

export class ServerPropertiesDto {
  @IsNumber({ optional: true })
  uptime?: bigint;

  @IsEnum({ enum: { ServerStatus }, optional: true })
  status?: ServerStatus;

  @IsDate({ format: 'date-time', optional: true })
  lastSeenAt?: Date;

  @IsBoolean({ optional: true })
  isOnline?: boolean;

  @IsNested({ type: UserDto, optional: true })
  startedBy?: UserDto;

  @IsNested({ type: CpuDto, optional: true })
  cpuInfo?: CpuDto;

  @IsNested({ type: MemoryDto, optional: true })
  memoryInfo?: MemoryDto;

  @IsNested({ type: DiskInfoDto, isArray: true, optional: true })
  diskInfo?: DiskInfoDto[];
}

import { ServerStatus } from '@prisma/client';

import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class LoadDto {
  @IsNumber()
  currentLoad: number;

  @IsNumber()
  currentLoadUser: number;

  @IsNumber()
  currentLoadSystem: number;
}

export class MemoryDto {
  @IsNumber()
  total: number;

  @IsNumber()
  free: number;
}

export class DiskInfoDto {
  @IsString()
  fs: string;

  @IsString()
  type: string;

  @IsNumber()
  used: number;

  @IsNumber()
  available: number;
}

export class ServerPropertiesDto {
  @IsString()
  name: string;

  @IsNumber({ optional: true })
  uptime: number;

  @IsNested({ type: LoadDto, optional: true })
  cpu?: LoadDto;

  @IsNested({ type: MemoryDto, optional: true })
  memory?: MemoryDto;

  @IsNested({ type: DiskInfoDto, isArray: true, optional: true })
  disk?: DiskInfoDto[];
}

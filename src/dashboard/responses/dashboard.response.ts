import { CommandRuntimeStatus, ServerProcessStatus } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

class CountByDto {
  @IsString()
  key: string;

  @IsNumber()
  count: number;
}

class DashboardServersDto {
  @IsNumber()
  total: number;

  @IsNumber()
  online: number;

  @IsNumber()
  offline: number;
}

class DashboardRecentProcessDto {
  @IsString()
  id: string;

  @IsString({ optional: true })
  name?: string;

  @IsEnum({ enum: { ServerProcessStatus } })
  status: ServerProcessStatus;

  @IsEnum({ enum: { CommandRuntimeStatus } })
  runtimeStatus: CommandRuntimeStatus;

  @IsNumber({ optional: true })
  progress?: number;

  @IsDate({ format: 'date-time' })
  startedAt: Date;
}

class DashboardProcessesDto {
  @IsNumber()
  total: number;

  @IsNumber()
  running: number;

  @IsNumber()
  failed: number;

  @IsNested({ type: DashboardRecentProcessDto, isArray: true })
  recent: DashboardRecentProcessDto[];
}

class DashboardUsersDto {
  @IsNumber()
  total: number;
}

class DashboardPhotoEntriesDto {
  @IsNumber()
  total: number;

  @IsNested({ type: CountByDto, isArray: true })
  byType: CountByDto[];

  @IsNested({ type: CountByDto, isArray: true })
  byStatus: CountByDto[];
}

class DashboardTransfersDto {
  @IsNumber()
  total: number;

  @IsNumber()
  running: number;

  @IsNumber()
  failed: number;
}

export class DashboardResponseDto {
  @IsNested({ type: DashboardServersDto })
  servers: DashboardServersDto;

  @IsNested({ type: DashboardProcessesDto })
  processes: DashboardProcessesDto;

  @IsNested({ type: DashboardUsersDto })
  users: DashboardUsersDto;

  @IsNested({ type: DashboardPhotoEntriesDto })
  photoEntries: DashboardPhotoEntriesDto;

  @IsNested({ type: DashboardTransfersDto })
  transfers: DashboardTransfersDto;
}

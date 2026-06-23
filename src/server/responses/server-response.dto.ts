import { ServerStatus } from '@prisma/client';
import { IsBoolean, IsDate, IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';

/** Compact status for list/badge rendering (no heavy CPU/disk/memory payload). */
export class ServerStatusSummaryDto {
  @IsEnum({ enum: { ServerStatus }, optional: true, nullable: true })
  status?: ServerStatus | null;

  @IsBoolean({ optional: true, nullable: true })
  isOnline?: boolean | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  lastSeenAt?: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  statusChangedAt?: Date | null;
}

export class ServerResponseDto {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString()
  ipAddress: string;

  @IsString({ optional: true })
  macAddress?: string;

  @IsString({ optional: true })
  location: string;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;

  @IsNested({ type: ServerStatusSummaryDto, optional: true, nullable: true })
  properties?: ServerStatusSummaryDto | null;
}

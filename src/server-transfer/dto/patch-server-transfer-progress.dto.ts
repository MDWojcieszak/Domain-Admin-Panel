import { ServerTransferStatus } from '@prisma/client';
import { IsDate, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class PatchServerTransferProgressDto {
  @IsString()
  categoryId: string;

  @IsString()
  transferName: string;

  @IsEnum({ enum: { ServerTransferStatus }, optional: true })
  status?: ServerTransferStatus;

  @IsNumber({ optional: true })
  queuedFiles?: bigint;

  @IsNumber({ optional: true })
  queuedBytes?: bigint;

  @IsNumber({ optional: true })
  sentFiles?: bigint;

  @IsNumber({ optional: true })
  sentBytes?: bigint;

  @IsString({ optional: true })
  currentProcessId?: string;

  @IsString({ optional: true })
  lastProcessId?: string;

  @IsDate({ format: 'date-time', optional: true })
  lastError?: Date;

  @IsDate({ format: 'date-time', optional: true })
  lastRunAt?: Date;

  @IsDate({ format: 'date-time', optional: true })
  lastSuccessAt?: Date;
}

import { ServerTransferMode, ServerTransferStatus } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class ServerTransferResponse {
  @IsString()
  id: string;

  @IsString()
  serverCategoryId: string;

  @IsString()
  name: string;

  @IsString({ optional: true })
  description?: string;

  @IsString()
  originPath: string;

  @IsString()
  targetPath: string;

  @IsString({ optional: true })
  agentLogPath?: string;

  @IsBoolean()
  enableMoveBackup: boolean;

  @IsString({ optional: true })
  moveBackupPath?: string;

  @IsEnum({ enum: { ServerTransferMode } })
  mode: ServerTransferMode;

  @IsEnum({ enum: { ServerTransferStatus } })
  status: ServerTransferStatus;

  @IsNumber({ type: 'integer', optional: true })
  bwLimitKbps?: number | null;

  @IsNumber({ type: 'integer' })
  secondsStart: number;

  @IsNumber({ type: 'integer' })
  secondsStop: number;

  @IsBoolean()
  isEnabled: boolean;

  @IsNumber()
  queuedFiles: bigint;

  @IsNumber()
  queuedBytes: bigint;

  @IsNumber()
  sentFiles: bigint;

  @IsNumber()
  sentBytes: bigint;

  @IsString({ optional: true })
  currentProcessId?: string | null;

  @IsString({ optional: true })
  lastProcessId?: string | null;

  @IsString({ optional: true })
  lastRunAt?: Date | null;

  @IsString({ optional: true })
  lastSuccessAt?: Date | null;

  @IsString({ optional: true })
  lastError?: Date | null;

  @IsString()
  createdAt: Date;

  @IsString()
  updatedAt: Date;
}

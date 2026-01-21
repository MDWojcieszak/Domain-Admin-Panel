import { ServerTransferMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CreateServerTransferDto {
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

  @IsNumber({ type: 'integer', optional: true })
  bwLimitKbps?: number;

  @IsNumber({ type: 'integer' })
  secondsStart: number;

  @IsNumber({ type: 'integer' })
  secondsStop: number;

  @IsBoolean()
  isEnabled: boolean;
}

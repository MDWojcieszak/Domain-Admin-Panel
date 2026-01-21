import { ServerTransferMode } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class PatchServerTransferDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true })
  description?: string;

  @IsString({ optional: true })
  originPath?: string;

  @IsString({ optional: true })
  targetPath?: string;

  @IsString({ optional: true })
  agentLogPath?: string;

  @IsBoolean({ optional: true })
  enableMoveBackup?: boolean;

  @IsString({ optional: true })
  moveBackupPath?: string;

  @IsEnum({ enum: { ServerTransferMode }, optional: true })
  mode?: ServerTransferMode;

  @IsNumber({ type: 'integer', optional: true })
  bwLimitKbps?: number;

  @IsNumber({ type: 'integer', optional: true })
  secondsStart?: number;

  @IsNumber({ type: 'integer', optional: true })
  secondsStop?: number;

  @IsBoolean({ optional: true })
  isEnabled?: boolean;
}

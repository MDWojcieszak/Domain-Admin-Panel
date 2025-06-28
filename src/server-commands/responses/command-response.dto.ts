import { CommandStatus, CommandType } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CommandResponseDto {
  @IsString()
  id: string;

  @IsString({ optional: true })
  name?: string;

  @IsString()
  value: string;

  @IsEnum({ enum: { CommandStatus } })
  status: CommandStatus;

  @IsNumber({ optional: true })
  runningProgress?: number;

  @IsEnum({ enum: { CommandType } })
  type: CommandType;
}

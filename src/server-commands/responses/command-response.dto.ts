import { CommandStatus, CommandType } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export class CommandResponseDto {
  @IsString()
  id: string;

  @IsString({ optional: true })
  name?: string;

  @IsString()
  value: string;

  @IsEnum({ enum: { CommandStatus } })
  status: CommandStatus;

  @IsEnum({ enum: { CommandType } })
  type: CommandType;
}

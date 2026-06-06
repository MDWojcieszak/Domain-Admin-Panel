import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';
import { CommandRuntimeStatus, CommandStatus } from '@prisma/client';

export class UpdateServerCommandDto {
  @IsString()
  serverName: string;

  @IsString()
  commandName: string;

  @IsString()
  category: string;

  @IsNumber({ optional: true })
  runningProgress: number;

  @IsEnum({ enum: { CommandStatus }, optional: true })
  status: CommandStatus;

  @IsEnum({ enum: { CommandRuntimeStatus }, optional: true })
  runtimeStatus?: CommandRuntimeStatus;
}

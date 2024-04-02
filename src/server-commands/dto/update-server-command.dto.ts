import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';
import { CommandStatus, CommandType } from '@prisma/client';

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
}

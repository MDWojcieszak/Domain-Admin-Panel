import { IsEnum, IsString } from 'nestjs-swagger-dto';
import { CommandStatus } from '@prisma/client';

export class UpdateServerCommandDto {
  @IsString()
  serverName: string;

  @IsString()
  commandName: string;

  @IsString()
  category: string;

  @IsEnum({ enum: { CommandStatus }, optional: true })
  status?: CommandStatus;
}

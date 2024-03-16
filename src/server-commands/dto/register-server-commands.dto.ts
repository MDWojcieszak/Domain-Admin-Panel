import { IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';
import { CommandType } from '@prisma/client';

export class ServerCommandDto {
  @IsString()
  commandName: string;

  @IsEnum({ enum: { CommandType } })
  commandType: CommandType;

  @IsString()
  category: string;
}

export class RegisterServerCommandsDto {
  @IsString()
  serverName: string;

  @IsNested({ type: ServerCommandDto, isArray: true })
  commands: ServerCommandDto[];
}

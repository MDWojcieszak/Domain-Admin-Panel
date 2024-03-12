import { IsNested, IsString } from 'nestjs-swagger-dto';
import { IsEnum, IsNumber } from 'class-validator';
import { CommandType } from '@prisma/client';

export class ServerCommandDto {
  @IsString()
  commandName: string;

  @IsEnum(CommandType)
  commandType: CommandType;

  @IsString()
  commandCategory: string;
}

export class RegisterServerCommandsDto {
  @IsString()
  serverName: string;

  @IsNested({ type: ServerCommandDto, isArray: true })
  commands: ServerCommandDto[];
}

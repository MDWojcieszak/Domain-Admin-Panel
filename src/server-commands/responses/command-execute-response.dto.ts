import { CommandStatus, CommandType } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CommandExecuteResponseDto {
  @IsBoolean()
  success: boolean;
}

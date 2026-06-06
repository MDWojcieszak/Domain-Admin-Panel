import { IsBoolean } from 'nestjs-swagger-dto';

export class CommandExecuteResponseDto {
  @IsBoolean()
  success: boolean;
}

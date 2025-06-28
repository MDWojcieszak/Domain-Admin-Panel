import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { CommandResponseDto } from './command-response.dto';

export class CommandListResponseDto {
  @IsNested({ type: CommandResponseDto, isArray: true })
  commands: CommandResponseDto[];

  @IsNumber()
  total: number;
}

import { IsNested, IsNumber } from 'nestjs-swagger-dto';
import { ServerSettingsResponseDto } from './server-settings-response.dto';

export class ServerSettingsListResponseDto {
  @IsNested({ type: ServerSettingsResponseDto, isArray: true })
  settings: ServerSettingsResponseDto[];

  @IsNumber()
  total: number;
}

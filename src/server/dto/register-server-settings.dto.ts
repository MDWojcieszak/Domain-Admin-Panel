import { IsNested, IsString } from 'nestjs-swagger-dto';

export class ServerSettingsDto {
  @IsString()
  settingName: string;

  @IsString()
  settingCategory: string;
}

export class RegisterServerSettingsDto {
  @IsString()
  serverName: string;

  @IsNested({ type: ServerSettingsDto, isArray: true })
  commands: ServerSettingsDto[];
}

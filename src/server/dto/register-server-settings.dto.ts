import { SettingType } from '@prisma/client';
import { IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';

export class ServerSettingsDto {
  @IsString()
  settingName: string;

  @IsString()
  settingValue: string;

  @IsEnum({ enum: { SettingType } })
  settingType: SettingType;

  @IsString()
  category: string;
}

export class RegisterServerSettingsDto {
  @IsString()
  serverName: string;

  @IsNested({ type: ServerSettingsDto, isArray: true })
  settings: ServerSettingsDto[];
}

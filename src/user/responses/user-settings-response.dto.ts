import { IsBoolean, IsString } from 'nestjs-swagger-dto';

export class UserSettingsResponseDto {
  @IsString()
  id: string;

  @IsBoolean()
  serverStatusEmailNotifications: boolean;

  @IsBoolean()
  serverIdleEmailNotifications: boolean;

  @IsBoolean()
  serverPushNotifications: boolean;

  @IsBoolean()
  processEmailNotifications: boolean;

  @IsBoolean()
  processPushNotifications: boolean;
}

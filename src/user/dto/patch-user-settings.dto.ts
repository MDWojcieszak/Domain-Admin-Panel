import { IsBoolean } from 'nestjs-swagger-dto';

export class PatchUserSettingsDto {
  @IsBoolean({ optional: true })
  serverStatusEmailNotifications?: boolean;

  @IsBoolean({ optional: true })
  serverIdleEmailNotifications?: boolean;

  @IsBoolean({ optional: true })
  serverPushNotifications?: boolean;

  @IsBoolean({ optional: true })
  processEmailNotifications?: boolean;

  @IsBoolean({ optional: true })
  processPushNotifications?: boolean;
}

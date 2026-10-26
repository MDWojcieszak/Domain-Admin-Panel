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

  /** Reminder about unsecured photo media (cards, film, tethered frames). */
  @IsBoolean({ optional: true })
  photoMediaEmailNotifications?: boolean;

  /** Pre-trip reminders: wishlist gear to buy, packing the day before. */
  @IsBoolean({ optional: true })
  tripEmailNotifications?: boolean;

  /** A visitor sent an inquiry through the public contact form. */
  @IsBoolean({ optional: true })
  inquiryEmailNotifications?: boolean;

  /** A task's reminder time came. */
  @IsBoolean({ optional: true })
  taskEmailNotifications?: boolean;

  /** A morning mail: what is due today, what is late, what is left to buy. */
  @IsBoolean({ optional: true })
  dailyDigestEmail?: boolean;
}

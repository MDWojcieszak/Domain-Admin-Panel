import { CalendarScope } from '@prisma/client';
import { IsBoolean, IsDate, IsEnum, IsString } from 'nestjs-swagger-dto';

/** The feed as its owner sees it; the token is shown only when made. */
export class CalendarFeedResponse {
  @IsBoolean()
  enabled: boolean;

  @IsEnum({ enum: { CalendarScope } })
  scope: CalendarScope;

  /** When a calendar app last fetched it. */
  @IsDate({ format: 'date-time', optional: true, nullable: true })
  lastUsedAt: Date | null;

  @IsDate({ format: 'date-time', optional: true, nullable: true })
  createdAt: Date | null;
}

export class CreatedCalendarFeedResponse extends CalendarFeedResponse {
  /** Goes into the address: /calendar/<token>.ics. Not shown again. */
  @IsString()
  token: string;
}

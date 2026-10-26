import { CalendarScope } from '@prisma/client';
import { IsEnum } from 'nestjs-swagger-dto';

export class CalendarFeedDto {
  /** MINE: assigned to you or in your inbox; ALL: every dated task you can see. */
  @IsEnum({ enum: { CalendarScope }, optional: true })
  scope?: CalendarScope;
}

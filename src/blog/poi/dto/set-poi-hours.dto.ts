import { Weekday } from '@prisma/client';
import { IsBoolean, IsEnum, IsNested, IsString } from 'nestjs-swagger-dto';

export class PoiHourEntryDto {
  @IsEnum({ enum: { Weekday } })
  weekday: Weekday;

  @IsString({
    optional: true,
    nullable: true,
    description: 'HH:mm (validated server-side); ignored when closed=true.',
  })
  opensAt?: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'HH:mm (validated server-side); ignored when closed=true.',
  })
  closesAt?: string | null;

  @IsBoolean({ optional: true })
  closed?: boolean;
}

/** Replaces the full weekly schedule (idempotent). Weekdays omitted are cleared. */
export class SetPoiHoursDto {
  @IsNested({ type: PoiHourEntryDto, isArray: true })
  hours: PoiHourEntryDto[];
}

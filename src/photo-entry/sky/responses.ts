import {
  IsBoolean,
  IsDate,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { PhotoEntryLocationResponse } from '../location/entry-location';

const optionalDate = {
  format: 'date-time',
  optional: true,
  nullable: true,
} as const;

export class TimeWindowResponse {
  @IsDate({ format: 'date-time' })
  start: Date;

  @IsDate({ format: 'date-time' })
  end: Date;
}

export class SunTimesResponse {
  @IsDate(optionalDate) rise: Date | null;
  @IsDate(optionalDate) set: Date | null;
  @IsDate(optionalDate) civilDawn: Date | null;
  @IsDate(optionalDate) civilDusk: Date | null;
  @IsDate(optionalDate) nauticalDawn: Date | null;
  @IsDate(optionalDate) nauticalDusk: Date | null;
  @IsDate(optionalDate) astronomicalDawn: Date | null;
  @IsDate(optionalDate) astronomicalDusk: Date | null;
}

export class DayWindowsResponse {
  @IsNested({ type: TimeWindowResponse, optional: true, nullable: true })
  morning: TimeWindowResponse | null;

  @IsNested({ type: TimeWindowResponse, optional: true, nullable: true })
  evening: TimeWindowResponse | null;
}

export class MoonResponse {
  @IsDate(optionalDate) rise: Date | null;
  @IsDate(optionalDate) set: Date | null;

  /** 0–100 at local noon. */
  @IsNumber({ type: 'integer' })
  illumination: number;

  /** NEW, WAXING_CRESCENT, FIRST_QUARTER, WAXING_GIBBOUS, FULL, … */
  @IsString()
  phase: string;
}

export class MilkyWayCoreResponse extends TimeWindowResponse {
  @IsNumber({ type: 'integer' })
  minutes: number;
}

export class NightResponse {
  /** Astronomical dusk to dawn. */
  @IsNested({ type: TimeWindowResponse })
  darkness: TimeWindowResponse;

  /** Darkness with the moon below the horizon — the deep-sky budget. */
  @IsNumber({ type: 'integer' })
  darkSkyMinutes: number;

  @IsNested({ type: TimeWindowResponse, isArray: true })
  darkSkyWindows: TimeWindowResponse[];

  /** Galactic core above 10° in dark sky; null when it never is. */
  @IsNested({ type: MilkyWayCoreResponse, optional: true, nullable: true })
  milkyWayCore: MilkyWayCoreResponse | null;
}

export class SkyDayResponse {
  /** Local date at the place, YYYY-MM-DD. */
  @IsString()
  date: string;

  @IsNested({ type: SunTimesResponse })
  sun: SunTimesResponse;

  /** Sun between −4° and +6°. */
  @IsNested({ type: DayWindowsResponse })
  goldenHour: DayWindowsResponse;

  /** Sun between −6° and −4°. */
  @IsNested({ type: DayWindowsResponse })
  blueHour: DayWindowsResponse;

  @IsNested({ type: MoonResponse })
  moon: MoonResponse;

  /** The night starting this evening; null without astronomical darkness. */
  @IsNested({ type: NightResponse, optional: true, nullable: true })
  night: NightResponse | null;
}

export class EclipseContactsResponse {
  @IsDate(optionalDate) partialBegin: Date | null;
  @IsDate(optionalDate) totalBegin: Date | null;
  @IsDate(optionalDate) totalEnd: Date | null;
  @IsDate(optionalDate) partialEnd: Date | null;
}

export class SkyEclipseResponse {
  /** SUN | MOON */
  @IsString()
  body: string;

  /** partial | annular | total | penumbral */
  @IsString()
  kind: string;

  @IsDate({ format: 'date-time' })
  peak: Date;

  /** Solar: covered fraction of the disc at the place, 0–1. */
  @IsNumber({ optional: true, nullable: true })
  obscuration: number | null;

  @IsNumber()
  altitudeAtPeak: number;

  @IsBoolean()
  visible: boolean;

  @IsNested({ type: EclipseContactsResponse, optional: true, nullable: true })
  contacts: EclipseContactsResponse | null;
}

export class PhotoEntrySkyResponse {
  @IsString()
  photoEntryId: string;

  @IsNested({ type: PhotoEntryLocationResponse })
  location: PhotoEntryLocationResponse;

  /** Show every time in this zone — the place's, not the viewer's. */
  @IsString()
  timezone: string;

  @IsNested({ type: SkyDayResponse, isArray: true })
  days: SkyDayResponse[];

  /** The entry is longer than the 14 days computed. */
  @IsBoolean()
  truncated: boolean;

  /** Eclipses peaking during the entry, with visibility at the place. */
  @IsNested({ type: SkyEclipseResponse, isArray: true })
  eclipses: SkyEclipseResponse[];
}

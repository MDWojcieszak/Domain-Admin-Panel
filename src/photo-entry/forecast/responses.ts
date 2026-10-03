import {
  IsBoolean,
  IsDate,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { PhotoEntryLocationResponse } from '../location/entry-location';

const n = { optional: true, nullable: true } as const;

export class ForecastHourResponse {
  @IsDate({ format: 'date-time' })
  time: Date;

  @IsNumber(n) temperature: number | null;
  /** Percent. */
  @IsNumber(n) cloudCover: number | null;
  @IsNumber(n) cloudLow: number | null;
  @IsNumber(n) cloudMid: number | null;
  @IsNumber(n) cloudHigh: number | null;
  @IsNumber(n) precipitationProbability: number | null;
  /** mm in the hour. */
  @IsNumber(n) precipitation: number | null;
  /** km/h. */
  @IsNumber(n) windSpeed: number | null;
  @IsNumber(n) windGusts: number | null;
  /** metres. */
  @IsNumber(n) visibility: number | null;
}

export class ForecastDaySummaryResponse {
  /** Mean cloud, sunrise to sunset. */
  @IsNumber(n) cloudDay: number | null;
  /** Mean cloud in the evening golden hour. */
  @IsNumber(n) cloudGoldenEvening: number | null;
  /** Mean cloud in the astronomical darkness starting this evening. */
  @IsNumber(n) cloudNight: number | null;
  @IsNumber(n) precipitationProbabilityMax: number | null;
  @IsNumber(n) precipitationSum: number | null;
  @IsNumber(n) windGustMax: number | null;
  @IsNumber(n) temperatureMin: number | null;
  @IsNumber(n) temperatureMax: number | null;
}

export class ForecastDayResponse {
  /** Local date at the place. */
  @IsString()
  date: string;

  @IsNested({ type: ForecastDaySummaryResponse })
  summary: ForecastDaySummaryResponse;

  @IsNested({ type: ForecastHourResponse, isArray: true })
  hourly: ForecastHourResponse[];
}

export class PhotoEntryForecastResponse {
  @IsString()
  photoEntryId: string;

  @IsNested({ type: PhotoEntryLocationResponse })
  location: PhotoEntryLocationResponse;

  @IsString()
  timezone: string;

  /** False when the entry is beyond the 16-day horizon or already over. */
  @IsBoolean()
  available: boolean;

  /** TOO_EARLY | PAST, when not available. */
  @IsString(n)
  reason: string | null;

  /** TOO_EARLY: when the forecast will start covering the entry. */
  @IsDate({ format: 'date-time', ...n })
  availableFrom: Date | null;

  @IsDate({ format: 'date-time', ...n })
  fetchedAt: Date | null;

  /** Show "Weather data by Open-Meteo.com" — required by its licence (CC BY 4.0). */
  @IsString()
  source: string;

  @IsNested({ type: ForecastDayResponse, isArray: true })
  days: ForecastDayResponse[];
}

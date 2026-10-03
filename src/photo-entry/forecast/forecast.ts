import { TimeWindow } from '../sky/sky';

/**
 * Weather forecast for an entry (docs/photo-entry-planning-and-publish.md §5),
 * from Open-Meteo. Pure parsing and summarising, so it is tested on fixtures
 * without the network.
 */

/** Open-Meteo forecasts this far ahead; further out there is nothing to show. */
export const FORECAST_HORIZON_DAYS = 16;

export const OPEN_METEO_HOURLY = [
  'temperature_2m',
  'cloud_cover',
  'cloud_cover_low',
  'cloud_cover_mid',
  'cloud_cover_high',
  'precipitation_probability',
  'precipitation',
  'wind_speed_10m',
  'wind_gusts_10m',
  'visibility',
] as const;

export interface OpenMeteoResponse {
  hourly: { time: number[] } & Partial<
    Record<(typeof OPEN_METEO_HOURLY)[number], Array<number | null>>
  >;
}

export interface ForecastHour {
  time: Date;
  temperature: number | null;
  /** Percent, 0–100. */
  cloudCover: number | null;
  cloudLow: number | null;
  cloudMid: number | null;
  cloudHigh: number | null;
  precipitationProbability: number | null;
  /** mm in the hour. */
  precipitation: number | null;
  /** km/h. */
  windSpeed: number | null;
  windGusts: number | null;
  /** metres. */
  visibility: number | null;
}

export const forecastUrl = (latitude: number, longitude: number): string =>
  'https://api.open-meteo.com/v1/forecast' +
  `?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}` +
  `&hourly=${OPEN_METEO_HOURLY.join(',')}` +
  `&forecast_days=${FORECAST_HORIZON_DAYS}&timezone=GMT&timeformat=unixtime`;

export const parseHours = (body: OpenMeteoResponse): ForecastHour[] => {
  const h = body.hourly;
  const at = (key: (typeof OPEN_METEO_HOURLY)[number], i: number) =>
    h[key]?.[i] ?? null;
  return h.time.map((t, i) => ({
    time: new Date(t * 1000),
    temperature: at('temperature_2m', i),
    cloudCover: at('cloud_cover', i),
    cloudLow: at('cloud_cover_low', i),
    cloudMid: at('cloud_cover_mid', i),
    cloudHigh: at('cloud_cover_high', i),
    precipitationProbability: at('precipitation_probability', i),
    precipitation: at('precipitation', i),
    windSpeed: at('wind_speed_10m', i),
    windGusts: at('wind_gusts_10m', i),
    visibility: at('visibility', i),
  }));
};

const inWindow = (hours: ForecastHour[], w: TimeWindow) =>
  hours.filter((h) => h.time >= w.start && h.time < w.end);

const values = (
  hours: ForecastHour[],
  pick: (h: ForecastHour) => number | null,
) => hours.map(pick).filter((v): v is number => v !== null);

const avg = (xs: number[]): number | null =>
  xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null;

const max = (xs: number[]): number | null =>
  xs.length ? Math.max(...xs) : null;

const min = (xs: number[]): number | null =>
  xs.length ? Math.min(...xs) : null;

const sum = (xs: number[]): number | null =>
  xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) * 10) / 10 : null;

/**
 * Mean cloud cover in a window. A window shorter than an hour still takes the
 * hour it falls in — a 40-minute golden hour deserves an answer.
 */
export const cloudIn = (
  hours: ForecastHour[],
  w: TimeWindow | null,
): number | null => {
  if (!w) return null;
  let picked = inWindow(hours, w);
  if (!picked.length) {
    const hourStart = new Date(Math.floor(w.start.getTime() / 3600e3) * 3600e3);
    picked = hours.filter((h) => h.time.getTime() === hourStart.getTime());
  }
  return avg(values(picked, (h) => h.cloudCover));
};

export interface ForecastDaySummary {
  /** Sunrise to sunset. */
  cloudDay: number | null;
  /** Evening golden hour — the landscape question. */
  cloudGoldenEvening: number | null;
  /** Astronomical darkness of the night starting this evening — the astro question. */
  cloudNight: number | null;
  precipitationProbabilityMax: number | null;
  precipitationSum: number | null;
  windGustMax: number | null;
  temperatureMin: number | null;
  temperatureMax: number | null;
}

export const summarizeDay = (
  dayHours: ForecastHour[],
  allHours: ForecastHour[],
  windows: {
    day: TimeWindow | null;
    goldenEvening: TimeWindow | null;
    night: TimeWindow | null;
  },
): ForecastDaySummary => ({
  cloudDay: cloudIn(allHours, windows.day),
  cloudGoldenEvening: cloudIn(allHours, windows.goldenEvening),
  // The night runs past midnight, so it is cut from all hours, not the day's.
  cloudNight: cloudIn(allHours, windows.night),
  precipitationProbabilityMax: max(
    values(dayHours, (h) => h.precipitationProbability),
  ),
  precipitationSum: sum(values(dayHours, (h) => h.precipitation)),
  windGustMax: max(values(dayHours, (h) => h.windGusts)),
  temperatureMin: min(values(dayHours, (h) => h.temperature)),
  temperatureMax: max(values(dayHours, (h) => h.temperature)),
});

export type ForecastUnavailableReason = 'TOO_EARLY' | 'PAST';

/** Whether the entry falls inside the forecast horizon at all. */
export const forecastAvailability = (
  start: Date,
  end: Date | null,
  now: Date = new Date(),
):
  | { available: true }
  | {
      available: false;
      reason: ForecastUnavailableReason;
      availableFrom: Date | null;
    } => {
  const last = end ?? start;
  if (last.getTime() < now.getTime() - 24 * 3600e3) {
    return { available: false, reason: 'PAST', availableFrom: null };
  }
  const horizon = now.getTime() + (FORECAST_HORIZON_DAYS - 1) * 24 * 3600e3;
  if (start.getTime() > horizon) {
    return {
      available: false,
      reason: 'TOO_EARLY',
      availableFrom: new Date(
        start.getTime() - (FORECAST_HORIZON_DAYS - 1) * 24 * 3600e3,
      ),
    };
  }
  return { available: true };
};

/** One line for a reminder email. */
export const forecastLine = (s: ForecastDaySummary): string => {
  const parts: string[] = [];
  if (s.cloudDay !== null) parts.push(`cloud ${s.cloudDay}% by day`);
  if (s.cloudNight !== null) parts.push(`${s.cloudNight}% at night`);
  if (s.precipitationProbabilityMax !== null)
    parts.push(`rain chance up to ${s.precipitationProbabilityMax}%`);
  if (s.windGustMax !== null)
    parts.push(`gusts ${Math.round(s.windGustMax)} km/h`);
  return parts.join(', ');
};

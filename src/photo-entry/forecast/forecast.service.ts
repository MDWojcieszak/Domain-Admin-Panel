import {
  BadGatewayException,
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { toLocationResponse } from '../location/entry-location';
import { localMidnight, skyReport } from '../sky/sky';
import {
  ForecastHour,
  forecastAvailability,
  forecastUrl,
  OpenMeteoResponse,
  parseHours,
  summarizeDay,
} from './forecast';
import { PhotoEntryForecastResponse } from './responses';

const CACHE_TTL_MS = 60 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;
const DAY_MS = 24 * 60 * 60 * 1000;

interface CachedForecast {
  fetchedAt: Date;
  hours: ForecastHour[];
}

/**
 * Forecast for an entry from Open-Meteo (§5) — the one feature here that
 * sends anything out: the entry's coordinates. Cached in memory for an hour
 * per ~1 km cell, so opening an entry repeatedly does not hit the API.
 */
@Injectable()
export class ForecastService {
  private readonly logger = new Logger(ForecastService.name);
  private readonly cache = new Map<string, CachedForecast>();

  constructor(private readonly prisma: PrismaService) {}

  async forEntry(
    userId: string,
    entryId: string,
    now: Date = new Date(),
  ): Promise<PhotoEntryForecastResponse> {
    const entry = await this.prisma.photoEntry.findFirst({
      where: { id: entryId, userId },
      include: { location: true },
    });
    if (!entry) throw new NotFoundException('PhotoEntry not found');
    return this.build(entry, now);
  }

  /** Shared by the endpoint and the T-3 reminder. */
  async build(
    entry: {
      id: string;
      startDate: Date | null;
      endDate: Date | null;
      location: Parameters<typeof toLocationResponse>[0];
    },
    now: Date = new Date(),
  ): Promise<PhotoEntryForecastResponse> {
    const location = toLocationResponse(entry.location);
    if (!location) {
      throw new BadRequestException(
        'Set the entry location to see the forecast',
      );
    }
    if (!entry.startDate) {
      throw new BadRequestException(
        'Set the entry start date to see the forecast',
      );
    }

    const base = {
      photoEntryId: entry.id,
      location,
      timezone: location.timezone,
      source: 'Open-Meteo.com',
    };
    const availability = forecastAvailability(
      entry.startDate,
      entry.endDate,
      now,
    );
    if ('reason' in availability) {
      return {
        ...base,
        available: false,
        reason: availability.reason,
        availableFrom: availability.availableFrom,
        fetchedAt: null,
        days: [],
      };
    }

    const { hours, fetchedAt } = await this.hoursAt(
      location.latitude,
      location.longitude,
      now,
    );
    const sky = skyReport({
      latitude: location.latitude,
      longitude: location.longitude,
      timezone: location.timezone,
      start: entry.startDate,
      end: entry.endDate,
    });

    const days = sky.days
      .map((d) => {
        const from = localMidnight(location.timezone, d.date);
        const to = new Date(from.getTime() + DAY_MS);
        const dayHours = hours.filter((h) => h.time >= from && h.time < to);
        if (!dayHours.length) return null; // beyond the horizon
        return {
          date: d.date,
          summary: summarizeDay(dayHours, hours, {
            day:
              d.sun.rise && d.sun.set && d.sun.set > d.sun.rise
                ? { start: d.sun.rise, end: d.sun.set }
                : null,
            goldenEvening: d.goldenHour.evening,
            night: d.night?.darkness ?? null,
          }),
          hourly: dayHours,
        };
      })
      .filter((d): d is NonNullable<typeof d> => !!d);

    return {
      ...base,
      available: true,
      reason: null,
      availableFrom: null,
      fetchedAt,
      days,
    };
  }

  private async hoursAt(
    latitude: number,
    longitude: number,
    now: Date,
  ): Promise<CachedForecast> {
    // ~1 km cells: nearby entries share one request.
    const key = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
    const cached = this.cache.get(key);
    if (cached && now.getTime() - cached.fetchedAt.getTime() < CACHE_TTL_MS) {
      return cached;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(forecastUrl(latitude, longitude), {
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fresh = {
        fetchedAt: now,
        hours: parseHours((await res.json()) as OpenMeteoResponse),
      };
      this.cache.set(key, fresh);
      return fresh;
    } catch (err) {
      this.logger.warn(`Open-Meteo request failed: ${(err as Error).message}`);
      // A stale forecast beats none when the service hiccups.
      if (cached) return cached;
      throw new BadGatewayException(
        'The forecast service is not reachable right now',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

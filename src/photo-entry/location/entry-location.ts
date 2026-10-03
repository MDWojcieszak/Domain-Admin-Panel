import { BadRequestException } from '@nestjs/common';
import { Location, Prisma } from '@prisma/client';
import { find } from 'geo-tz/dist/find-all';
import { IsNumber, IsString } from 'nestjs-swagger-dto';

/**
 * The place of a photo entry (docs/photo-entry-planning-and-publish.md §3).
 * The entry owns its Location row: picking a blog POI only copies coordinates,
 * so editing an article can never move a shoot.
 */

export class PhotoEntryLocationDto {
  @IsString({ optional: true, nullable: true, maxLength: 200 })
  name?: string | null;

  @IsNumber({ min: -90, max: 90 })
  latitude: number;

  @IsNumber({ min: -180, max: 180 })
  longitude: number;

  /** IANA zone; resolved from the coordinates when omitted. */
  @IsString({ optional: true, maxLength: 64 })
  timezone?: string;
}

export class PhotoEntryLocationResponse {
  @IsString({ optional: true, nullable: true })
  name: string | null;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  /** Sky and forecast times are meant to be shown in this zone. */
  @IsString()
  timezone: string;
}

/**
 * IANA zone of a point. The full dataset on purpose: the "merged" one names
 * Iceland "Africa/Abidjan", and an approximate lookup put the Bieszczady in
 * Kyiv time — an hour off right where golden hour matters.
 */
export const timezoneAt = (latitude: number, longitude: number): string =>
  find(latitude, longitude)[0] ?? 'UTC';

export const assertTimezone = (zone: string): string => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
    return zone;
  } catch {
    throw new BadRequestException(`Unknown time zone: ${zone}`);
  }
};

export const toLocationResponse = (
  location: Location | null | undefined,
): PhotoEntryLocationResponse | null =>
  location && location.latitude !== null && location.longitude !== null
    ? {
        name: location.name,
        latitude: location.latitude,
        longitude: location.longitude,
        timezone:
          location.timezone ??
          timezoneAt(location.latitude, location.longitude),
      }
    : null;

/**
 * Sets, replaces or clears the entry's location inside a transaction.
 * `undefined` leaves it alone; `null` removes it (the row is the entry's own,
 * so it is deleted, not orphaned).
 */
export const applyLocation = async (
  tx: Prisma.TransactionClient,
  entry: { id: string; userId: string; locationId: string | null },
  input: PhotoEntryLocationDto | null | undefined,
): Promise<void> => {
  if (input === undefined) return;

  if (input === null) {
    if (!entry.locationId) return;
    await tx.photoEntry.update({
      where: { id: entry.id },
      data: { locationId: null },
    });
    await tx.location.delete({ where: { id: entry.locationId } });
    return;
  }

  const data = {
    name: input.name?.trim() || null,
    latitude: input.latitude,
    longitude: input.longitude,
    timezone: assertTimezone(
      input.timezone ?? timezoneAt(input.latitude, input.longitude),
    ),
  };

  if (entry.locationId) {
    await tx.location.update({ where: { id: entry.locationId }, data });
    return;
  }
  const location = await tx.location.create({
    data: { ...data, createdById: entry.userId },
  });
  await tx.photoEntry.update({
    where: { id: entry.id },
    data: { locationId: location.id },
  });
};

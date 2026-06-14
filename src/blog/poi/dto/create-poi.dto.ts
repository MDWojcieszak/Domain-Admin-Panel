import {
  PoiDifficulty,
  PoiPriceLevel,
  PoiSeason,
  PoiStatus,
  PoiVerdict,
} from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

/**
 * Only `name` + `latitude` + `longitude` are required. Every other field is
 * optional AND nullable — the editor may send `null` for empty form fields
 * (treated the same as omitting).
 */
export class CreatePoiDto {
  @IsString({ description: 'Canonical name (proper noun).' })
  name: string;

  @IsNumber({ min: -90, max: 90 })
  latitude: number;

  @IsNumber({ min: -180, max: 180 })
  longitude: number;

  @IsString({ optional: true, nullable: true })
  country?: string | null;

  @IsString({ optional: true, nullable: true })
  region?: string | null;

  @IsString({ optional: true, nullable: true })
  city?: string | null;

  @IsString({ optional: true, nullable: true })
  address?: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'IANA timezone, e.g. Atlantic/Reykjavik.',
  })
  timezone?: string | null;

  @IsString({ optional: true, nullable: true })
  googlePlaceId?: string | null;

  @IsString({ optional: true, nullable: true })
  osmId?: string | null;

  @IsNumber({ type: 'integer', min: 0, optional: true, nullable: true })
  visitDurationMin?: number | null;

  @IsNumber({
    type: 'integer',
    min: 1,
    max: 5,
    optional: true,
    nullable: true,
    description: 'Public AI weight 1–5.',
  })
  creatorRating?: number | null;

  @IsEnum({
    enum: { PoiVerdict },
    optional: true,
    nullable: true,
    description: 'INTERNAL — never public.',
  })
  creatorVerdict?: PoiVerdict | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'INTERNAL — never public.',
  })
  internalNote?: string | null;

  @IsEnum({ enum: { PoiPriceLevel }, optional: true, nullable: true })
  priceLevel?: PoiPriceLevel | null;

  @IsEnum({
    enum: { PoiSeason },
    isArray: true,
    optional: true,
    nullable: true,
  })
  bestSeasons?: PoiSeason[] | null;

  @IsString({ optional: true, nullable: true })
  websiteUrl?: string | null;

  @IsString({ optional: true, nullable: true })
  bookingUrl?: string | null;

  @IsString({ optional: true, nullable: true })
  mapsUrl?: string | null;

  @IsEnum({ enum: { PoiDifficulty }, optional: true, nullable: true })
  difficulty?: PoiDifficulty | null;

  @IsNumber({ min: 0, optional: true, nullable: true })
  distanceKm?: number | null;

  @IsNumber({ type: 'integer', min: 0, optional: true, nullable: true })
  elevationGainM?: number | null;

  @IsEnum({ enum: { PoiStatus }, optional: true, nullable: true })
  status?: PoiStatus | null;

  @IsString({ optional: true, nullable: true })
  coverImageId?: string | null;

  @IsString({
    isArray: true,
    optional: true,
    nullable: true,
    description: 'ATTRACTION category ids.',
  })
  categoryIds?: string[] | null;

  // --- optional initial translation ---
  @IsString({
    optional: true,
    nullable: true,
    description:
      'Locale for the initial translation. Defaults to the default locale.',
  })
  locale?: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'Localized name override for `locale`.',
  })
  localizedName?: string | null;

  @IsString({ optional: true, nullable: true })
  description?: string | null;
}

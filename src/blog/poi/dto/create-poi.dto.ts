import {
  PoiDifficulty,
  PoiPriceLevel,
  PoiSeason,
  PoiStatus,
  PoiVerdict,
} from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CreatePoiDto {
  @IsString({ description: 'Canonical name (proper noun).' })
  name: string;

  @IsNumber({ min: -90, max: 90 })
  latitude: number;

  @IsNumber({ min: -180, max: 180 })
  longitude: number;

  @IsString({ optional: true })
  country?: string;

  @IsString({ optional: true })
  region?: string;

  @IsString({ optional: true })
  city?: string;

  @IsString({ optional: true })
  address?: string;

  @IsString({
    optional: true,
    description: 'IANA timezone, e.g. Atlantic/Reykjavik.',
  })
  timezone?: string;

  @IsString({ optional: true })
  googlePlaceId?: string;

  @IsString({ optional: true })
  osmId?: string;

  @IsNumber({ type: 'integer', min: 0, optional: true })
  visitDurationMin?: number;

  @IsNumber({
    type: 'integer',
    min: 1,
    max: 5,
    optional: true,
    description: 'Public AI weight 1–5.',
  })
  creatorRating?: number;

  @IsEnum({
    enum: { PoiVerdict },
    optional: true,
    description: 'INTERNAL — never public.',
  })
  creatorVerdict?: PoiVerdict;

  @IsString({ optional: true, description: 'INTERNAL — never public.' })
  internalNote?: string;

  @IsEnum({ enum: { PoiPriceLevel }, optional: true })
  priceLevel?: PoiPriceLevel;

  @IsEnum({ enum: { PoiSeason }, isArray: true, optional: true })
  bestSeasons?: PoiSeason[];

  @IsString({ optional: true })
  websiteUrl?: string;

  @IsString({ optional: true })
  bookingUrl?: string;

  @IsString({ optional: true })
  mapsUrl?: string;

  @IsEnum({ enum: { PoiDifficulty }, optional: true })
  difficulty?: PoiDifficulty;

  @IsNumber({ min: 0, optional: true })
  distanceKm?: number;

  @IsNumber({ type: 'integer', min: 0, optional: true })
  elevationGainM?: number;

  @IsEnum({ enum: { PoiStatus }, optional: true })
  status?: PoiStatus;

  @IsString({ optional: true })
  coverImageId?: string;

  @IsString({
    isArray: true,
    optional: true,
    description: 'ATTRACTION category ids.',
  })
  categoryIds?: string[];

  // --- optional initial translation ---
  @IsString({
    optional: true,
    description:
      'Locale for the initial translation. Defaults to the default locale.',
  })
  locale?: string;

  @IsString({
    optional: true,
    description: 'Localized name override for `locale`.',
  })
  localizedName?: string;

  @IsString({ optional: true })
  description?: string;
}

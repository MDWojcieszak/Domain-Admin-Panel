import {
  PoiDifficulty,
  PoiPriceLevel,
  PoiSeason,
  PoiStatus,
  PoiVerdict,
} from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

/**
 * Patches POI scalars (neutral + internal). Nullable fields accept null to
 * clear. Categories, translations, hours and images have dedicated endpoints.
 */
export class PatchPoiDto {
  @IsString({ optional: true })
  name?: string;

  @IsString({ optional: true, nullable: true })
  country?: string | null;

  @IsString({ optional: true, nullable: true })
  region?: string | null;

  @IsString({ optional: true, nullable: true })
  city?: string | null;

  @IsString({ optional: true, nullable: true })
  address?: string | null;

  @IsNumber({ min: -90, max: 90, optional: true })
  latitude?: number;

  @IsNumber({ min: -180, max: 180, optional: true })
  longitude?: number;

  @IsString({ optional: true, nullable: true })
  timezone?: string | null;

  @IsString({ optional: true, nullable: true })
  googlePlaceId?: string | null;

  @IsString({ optional: true, nullable: true })
  osmId?: string | null;

  @IsNumber({ type: 'integer', min: 0, optional: true, nullable: true })
  visitDurationMin?: number | null;

  @IsNumber({ type: 'integer', min: 1, max: 5, optional: true, nullable: true })
  creatorRating?: number | null;

  @IsEnum({ enum: { PoiVerdict }, optional: true, nullable: true })
  creatorVerdict?: PoiVerdict | null;

  @IsString({ optional: true, nullable: true })
  internalNote?: string | null;

  @IsEnum({ enum: { PoiPriceLevel }, optional: true, nullable: true })
  priceLevel?: PoiPriceLevel | null;

  @IsEnum({
    enum: { PoiSeason },
    isArray: true,
    optional: true,
    description: 'Replaces the whole set.',
  })
  bestSeasons?: PoiSeason[];

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

  @IsEnum({ enum: { PoiStatus }, optional: true })
  status?: PoiStatus;

  @IsString({ optional: true, nullable: true })
  coverImageId?: string | null;
}

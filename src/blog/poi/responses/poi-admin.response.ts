import {
  CategoryKind,
  PoiDifficulty,
  PoiPriceLevel,
  PoiSeason,
  PoiStatus,
  PoiVerdict,
} from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { PoiHoursResponse, PoiImageResponse } from './poi-public.response';

export class PoiTranslationResponse {
  @IsString()
  locale: string;

  @IsString({ optional: true, nullable: true })
  name: string | null;

  @IsString({ optional: true, nullable: true })
  description: string | null;
}

export class PoiCategoryRefResponse {
  @IsString()
  id: string;

  @IsString()
  categoryId: string;

  @IsEnum({ enum: { CategoryKind } })
  kind: CategoryKind;

  @IsString()
  key: string;
}

/**
 * Full admin projection (BLOG_PLACE_MANAGE only). Includes the INTERNAL fields
 * (creatorVerdict, internalNote) and raw all-locale translations.
 */
export class PoiAdminResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  country: string | null;

  @IsString({ optional: true, nullable: true })
  region: string | null;

  @IsString({ optional: true, nullable: true })
  city: string | null;

  @IsString({ optional: true, nullable: true })
  address: string | null;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString({ optional: true, nullable: true })
  timezone: string | null;

  @IsString({ optional: true, nullable: true })
  googlePlaceId: string | null;

  @IsString({ optional: true, nullable: true })
  osmId: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  visitDurationMin: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  creatorRating: number | null;

  /** INTERNAL — never in public responses. */
  @IsEnum({ enum: { PoiVerdict }, optional: true, nullable: true })
  creatorVerdict: PoiVerdict | null;

  /** INTERNAL — never in public responses. */
  @IsString({ optional: true, nullable: true })
  internalNote: string | null;

  @IsEnum({ enum: { PoiPriceLevel }, optional: true, nullable: true })
  priceLevel: PoiPriceLevel | null;

  @IsEnum({ enum: { PoiSeason }, isArray: true })
  bestSeasons: PoiSeason[];

  @IsString({ optional: true, nullable: true })
  websiteUrl: string | null;

  @IsString({ optional: true, nullable: true })
  bookingUrl: string | null;

  @IsString({ optional: true, nullable: true })
  mapsUrl: string | null;

  @IsEnum({ enum: { PoiDifficulty }, optional: true, nullable: true })
  difficulty: PoiDifficulty | null;

  @IsNumber({ optional: true, nullable: true })
  distanceKm: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  elevationGainM: number | null;

  @IsEnum({ enum: { PoiStatus } })
  status: PoiStatus;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsNested({ type: PoiCategoryRefResponse, isArray: true })
  categories: PoiCategoryRefResponse[];

  @IsNested({ type: PoiHoursResponse, isArray: true })
  hours: PoiHoursResponse[];

  @IsNested({ type: PoiImageResponse, isArray: true })
  images: PoiImageResponse[];

  @IsNested({ type: PoiTranslationResponse, isArray: true })
  translations: PoiTranslationResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

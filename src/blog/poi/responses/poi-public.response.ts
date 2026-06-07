import {
  CategoryKind,
  PoiDifficulty,
  PoiPriceLevel,
  PoiSeason,
  PoiStatus,
  Weekday,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

/** Opening hours for one weekday (public-safe, used by both admin and public). */
export class PoiHoursResponse {
  @IsString()
  id: string;

  @IsEnum({ enum: { Weekday } })
  weekday: Weekday;

  @IsString({ optional: true, nullable: true })
  opensAt: string | null;

  @IsString({ optional: true, nullable: true })
  closesAt: string | null;

  @IsBoolean()
  closed: boolean;
}

/** A gallery image link (the Image asset is referenced by id, not embedded). */
export class PoiImageResponse {
  @IsString()
  id: string;

  @IsString()
  imageId: string;

  @IsNumber({ type: 'integer' })
  order: number;
}

/** Category as seen publicly: canonical key + kind + resolved label. */
export class PoiPublicCategoryResponse {
  @IsString()
  categoryId: string;

  @IsEnum({ enum: { CategoryKind } })
  kind: CategoryKind;

  @IsString()
  key: string;

  @IsString({ optional: true, nullable: true })
  label: string | null;
}

/**
 * Public projection of a POI. Internal fields (internalNote, creatorVerdict) are
 * STRUCTURALLY ABSENT — not nullable, not in the class — and are omitted from the
 * public Prisma select so they never leave the DB. creatorRating IS public.
 */
export class PoiPublicResponse {
  @IsString()
  id: string;

  /** Resolved localized override ?? canonical name (always non-null). */
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

  /** Public AI-weight signal (1–5). */
  @IsNumber({ type: 'integer', optional: true, nullable: true })
  creatorRating: number | null;

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

  /** Computed: status === PERMANENTLY_CLOSED (FE grey-out). */
  @IsBoolean()
  permanentlyClosed: boolean;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  /** Resolved localized description. */
  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsNested({ type: PoiPublicCategoryResponse, isArray: true })
  categories: PoiPublicCategoryResponse[];

  @IsNested({ type: PoiHoursResponse, isArray: true })
  hours: PoiHoursResponse[];

  @IsNested({ type: PoiImageResponse, isArray: true })
  images: PoiImageResponse[];

  /** True when localized text fell back to the default locale. */
  @IsBoolean()
  untranslated: boolean;
}

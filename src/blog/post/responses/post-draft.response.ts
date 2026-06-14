import {
  BlogAccessTier,
  BlogAspectRatio,
  BlogImageSize,
  BlogOverlayBackdrop,
  BlogOverlayPosition,
  BlogOverlayTheme,
  BlogPostStatus,
  BlogSectionType,
  CalloutVariant,
  EmbedProvider,
  GalleryLayout,
  PoiDifficulty,
  PoiPriceLevel,
  PoiSeason,
  PoiStatus,
  VersionState,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

/** A section image resolved to a single locale (presentation + localized text). */
export class ResolvedSectionImageResponse {
  @IsString()
  id: string;

  @IsString()
  imageId: string;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsEnum({ enum: { BlogImageSize } })
  size: BlogImageSize;

  @IsEnum({ enum: { BlogAspectRatio } })
  aspectRatio: BlogAspectRatio;

  @IsNumber({ optional: true, nullable: true })
  focalX: number | null;

  @IsNumber({ optional: true, nullable: true })
  focalY: number | null;

  @IsEnum({ enum: { BlogOverlayPosition }, optional: true, nullable: true })
  overlayPosition: BlogOverlayPosition | null;

  @IsEnum({ enum: { BlogOverlayTheme }, optional: true, nullable: true })
  overlayTheme: BlogOverlayTheme | null;

  @IsEnum({ enum: { BlogOverlayBackdrop }, optional: true, nullable: true })
  overlayBackdrop: BlogOverlayBackdrop | null;

  @IsString({ optional: true, nullable: true })
  caption: string | null;

  @IsString({ optional: true, nullable: true })
  alt: string | null;

  @IsString({ optional: true, nullable: true })
  overlayText: string | null;
}

export class ResolvedSectionListItemResponse {
  @IsString()
  id: string;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsString({ optional: true, nullable: true })
  content: string | null;
}

/** A section POI resolved to a single locale (public POI fields only). */
export class ResolvedSectionPoiResponse {
  @IsString()
  id: string;

  @IsString()
  poiId: string;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsString({ optional: true, nullable: true })
  country: string | null;

  @IsString({ optional: true, nullable: true })
  region: string | null;

  @IsString({ optional: true, nullable: true })
  city: string | null;

  @IsNumber()
  latitude: number;

  @IsNumber()
  longitude: number;

  @IsString({ optional: true, nullable: true })
  timezone: string | null;

  @IsEnum({ enum: { PoiStatus } })
  status: PoiStatus;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsString({ isArray: true })
  categoryIds: string[];

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  creatorRating: number | null;

  @IsEnum({ enum: { PoiPriceLevel }, optional: true, nullable: true })
  priceLevel: PoiPriceLevel | null;

  @IsEnum({ enum: { PoiSeason }, isArray: true })
  bestSeasons: PoiSeason[];

  @IsEnum({ enum: { PoiDifficulty }, optional: true, nullable: true })
  difficulty: PoiDifficulty | null;

  @IsNumber({ optional: true, nullable: true })
  distanceKm: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  elevationGainM: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  visitDurationMin: number | null;

  @IsString({ optional: true, nullable: true })
  websiteUrl: string | null;

  @IsString({ optional: true, nullable: true })
  bookingUrl: string | null;

  @IsString({ optional: true, nullable: true })
  mapsUrl: string | null;

  @IsString({ optional: true, nullable: true })
  googlePlaceId: string | null;

  @IsString({ optional: true, nullable: true })
  osmId: string | null;

  @IsBoolean()
  untranslated: boolean;
}

/** A collection embedded in a COLLECTION section, resolved to a single locale. */
export class ResolvedSectionCollectionResponse {
  @IsString()
  collectionId: string;

  @IsString()
  slug: string;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsNumber({ type: 'integer' })
  itemCount: number;

  @IsString({ optional: true, nullable: true })
  country: string | null;

  /** Resolved collection title (fetch by-slug for the full ranked items). */
  @IsString({ optional: true, nullable: true })
  title: string | null;
}

/** A section resolved to a single locale (layout fields + localized text). */
export class ResolvedSectionResponse {
  @IsString()
  id: string;

  @IsEnum({ enum: { BlogSectionType } })
  type: BlogSectionType;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsEnum({ enum: { BlogAccessTier } })
  minAccessTier: BlogAccessTier;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  headingLevel: number | null;

  @IsString({ optional: true, nullable: true })
  quoteAuthor: string | null;

  @IsEnum({ enum: { CalloutVariant }, optional: true, nullable: true })
  calloutVariant: CalloutVariant | null;

  @IsEnum({ enum: { GalleryLayout }, optional: true, nullable: true })
  galleryLayout: GalleryLayout | null;

  @IsString({ optional: true, nullable: true })
  embedUrl: string | null;

  @IsEnum({ enum: { EmbedProvider }, optional: true, nullable: true })
  embedProvider: EmbedProvider | null;

  @IsString({
    optional: true,
    nullable: true,
    description:
      'Parent section id (COLUMNS→COLUMN nesting); null at top level.',
  })
  parentId: string | null;

  @IsNumber({ optional: true, nullable: true })
  columnWidth: number | null;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsString({ optional: true, nullable: true })
  body: string | null;

  @IsString({ isArray: true })
  keywords: string[];

  /** True when the text fell back to the default locale. */
  @IsBoolean()
  untranslated: boolean;

  @IsNested({ type: ResolvedSectionImageResponse, isArray: true })
  images: ResolvedSectionImageResponse[];

  @IsNested({ type: ResolvedSectionListItemResponse, isArray: true })
  items: ResolvedSectionListItemResponse[];

  @IsNested({ type: ResolvedSectionPoiResponse, isArray: true })
  pois: ResolvedSectionPoiResponse[];

  @IsNested({
    type: ResolvedSectionCollectionResponse,
    optional: true,
    nullable: true,
  })
  collection: ResolvedSectionCollectionResponse | null;
}

/** Full draft version assembled for one locale (staff preview, no paywall). */
export class PostDraftResponse {
  @IsString()
  postId: string;

  @IsString()
  slug: string;

  @IsEnum({ enum: { BlogPostStatus } })
  status: BlogPostStatus;

  @IsEnum({ enum: { BlogAccessTier } })
  accessTier: BlogAccessTier;

  /** The locale actually resolved (may differ from the requested one). */
  @IsString()
  locale: string;

  @IsBoolean()
  hasUnpublishedChanges: boolean;

  @IsString()
  versionId: string;

  @IsNumber({ type: 'integer' })
  versionNumber: number;

  @IsEnum({ enum: { VersionState } })
  versionState: VersionState;

  @IsString({ optional: true, nullable: true })
  country: string | null;

  @IsString({ optional: true, nullable: true })
  region: string | null;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsString({ optional: true, nullable: true })
  ogImageId: string | null;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsString({ optional: true, nullable: true })
  subtitle: string | null;

  @IsString({ optional: true, nullable: true })
  excerpt: string | null;

  @IsString({ isArray: true })
  seoKeywords: string[];

  @IsString({ optional: true, nullable: true })
  metaTitle: string | null;

  @IsString({ optional: true, nullable: true })
  metaDescription: string | null;

  @IsString({ optional: true, nullable: true })
  canonicalUrl: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  wordCount: number | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  readingMinutes: number | null;

  /** True when the version text fell back to the default locale. */
  @IsBoolean()
  untranslated: boolean;

  @IsNested({ type: ResolvedSectionResponse, isArray: true })
  sections: ResolvedSectionResponse[];
}

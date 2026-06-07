import {
  BlogAccessTier,
  BlogAspectRatio,
  BlogImageSize,
  BlogMediaPosition,
  BlogMediaSplit,
  BlogMobileStackOrder,
  BlogOverlayBackdrop,
  BlogOverlayPosition,
  BlogOverlayTheme,
  BlogPostStatus,
  BlogSectionType,
  CalloutVariant,
  EmbedProvider,
  GalleryLayout,
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

  @IsEnum({ enum: { BlogMediaPosition }, optional: true, nullable: true })
  mediaPosition: BlogMediaPosition | null;

  @IsEnum({ enum: { BlogMediaSplit }, optional: true, nullable: true })
  mediaSplit: BlogMediaSplit | null;

  @IsEnum({ enum: { BlogMobileStackOrder }, optional: true, nullable: true })
  mobileStackOrder: BlogMobileStackOrder | null;

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

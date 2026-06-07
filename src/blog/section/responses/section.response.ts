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
  BlogSectionType,
  CalloutVariant,
  EmbedProvider,
  GalleryLayout,
} from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

export class SectionTranslationResponse {
  @IsString()
  locale: string;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsString({ optional: true, nullable: true })
  body: string | null;

  @IsString({ isArray: true })
  keywords: string[];
}

export class SectionImageTranslationResponse {
  @IsString()
  locale: string;

  @IsString({ optional: true, nullable: true })
  caption: string | null;

  @IsString({ optional: true, nullable: true })
  alt: string | null;

  @IsString({ optional: true, nullable: true })
  overlayText: string | null;
}

export class SectionImageResponse {
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

  @IsNested({ type: SectionImageTranslationResponse, isArray: true })
  translations: SectionImageTranslationResponse[];
}

export class SectionListItemTranslationResponse {
  @IsString()
  locale: string;

  @IsString({ optional: true, nullable: true })
  content: string | null;
}

export class SectionListItemResponse {
  @IsString()
  id: string;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsNested({ type: SectionListItemTranslationResponse, isArray: true })
  translations: SectionListItemTranslationResponse[];
}

/**
 * Raw section for the editor — all locales and children included, no locale
 * resolution or paywall cutting (that happens in the read views).
 */
export class SectionResponse {
  @IsString()
  id: string;

  @IsString()
  versionId: string;

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

  @IsNested({ type: SectionTranslationResponse, isArray: true })
  translations: SectionTranslationResponse[];

  @IsNested({ type: SectionImageResponse, isArray: true })
  images: SectionImageResponse[];

  @IsNested({ type: SectionListItemResponse, isArray: true })
  items: SectionListItemResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

import {
  BlogAccessTier,
  BlogMediaPosition,
  BlogMediaSplit,
  BlogMobileStackOrder,
  BlogSectionType,
  CalloutVariant,
  EmbedProvider,
  GalleryLayout,
} from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

/**
 * Creates a section under the post's draft version. Only fields valid for `type`
 * may be set (validated server-side). The optional initial-translation fields
 * seed one locale's text; further locales go through the translation endpoint.
 */
export class CreateSectionDto {
  @IsEnum({ enum: { BlogSectionType } })
  type: BlogSectionType;

  @IsNumber({
    type: 'integer',
    optional: true,
    description: 'Position; appended to the end when omitted.',
  })
  order?: number;

  @IsEnum({ enum: { BlogAccessTier }, optional: true })
  minAccessTier?: BlogAccessTier;

  // --- language-neutral, per-type layout fields ---
  @IsNumber({ type: 'integer', optional: true, min: 1, max: 6 })
  headingLevel?: number;

  @IsString({ optional: true })
  quoteAuthor?: string;

  @IsEnum({ enum: { CalloutVariant }, optional: true })
  calloutVariant?: CalloutVariant;

  @IsEnum({ enum: { GalleryLayout }, optional: true })
  galleryLayout?: GalleryLayout;

  @IsString({ optional: true })
  embedUrl?: string;

  @IsEnum({ enum: { EmbedProvider }, optional: true })
  embedProvider?: EmbedProvider;

  @IsEnum({ enum: { BlogMediaPosition }, optional: true })
  mediaPosition?: BlogMediaPosition;

  @IsEnum({ enum: { BlogMediaSplit }, optional: true })
  mediaSplit?: BlogMediaSplit;

  @IsEnum({ enum: { BlogMobileStackOrder }, optional: true })
  mobileStackOrder?: BlogMobileStackOrder;

  // --- optional initial translation ---
  @IsString({
    optional: true,
    description:
      'Locale for the initial translation. Defaults to the default locale.',
  })
  locale?: string;

  @IsString({ optional: true })
  title?: string;

  @IsString({
    optional: true,
    description: 'Markdown body for the initial locale.',
  })
  body?: string;

  @IsString({ isArray: true, optional: true })
  keywords?: string[];
}

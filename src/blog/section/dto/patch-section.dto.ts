import {
  BlogAccessTier,
  CalloutVariant,
  EmbedProvider,
  GalleryLayout,
} from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

/**
 * Patches language-neutral fields of a section. The section type is immutable;
 * only fields valid for the existing type may be set. Nullable fields accept
 * null to clear.
 */
export class PatchSectionDto {
  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsEnum({ enum: { BlogAccessTier }, optional: true })
  minAccessTier?: BlogAccessTier;

  @IsNumber({ type: 'integer', optional: true, nullable: true, min: 1, max: 6 })
  headingLevel?: number | null;

  @IsString({ optional: true, nullable: true })
  quoteAuthor?: string | null;

  @IsEnum({ enum: { CalloutVariant }, optional: true, nullable: true })
  calloutVariant?: CalloutVariant | null;

  @IsEnum({ enum: { GalleryLayout }, optional: true, nullable: true })
  galleryLayout?: GalleryLayout | null;

  @IsString({ optional: true, nullable: true })
  embedUrl?: string | null;

  @IsEnum({ enum: { EmbedProvider }, optional: true, nullable: true })
  embedProvider?: EmbedProvider | null;
}

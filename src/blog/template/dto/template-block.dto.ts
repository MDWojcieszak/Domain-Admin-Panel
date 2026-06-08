import {
  BlogAspectRatio,
  BlogImageSize,
  BlogMediaPosition,
  BlogMediaSplit,
  BlogMobileStackOrder,
  BlogOverlayPosition,
  BlogSectionType,
  CalloutVariant,
  GalleryLayout,
} from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

/** Layout-default fields shared by template-block create/patch. */
export class CreateTemplateBlockDto {
  @IsEnum({ enum: { BlogSectionType } })
  type: BlogSectionType;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsNumber({ type: 'integer', min: 1, max: 6, optional: true })
  headingLevel?: number;

  @IsEnum({ enum: { CalloutVariant }, optional: true })
  calloutVariant?: CalloutVariant;

  @IsEnum({ enum: { GalleryLayout }, optional: true })
  galleryLayout?: GalleryLayout;

  @IsEnum({ enum: { BlogMediaPosition }, optional: true })
  mediaPosition?: BlogMediaPosition;

  @IsEnum({ enum: { BlogMediaSplit }, optional: true })
  mediaSplit?: BlogMediaSplit;

  @IsEnum({ enum: { BlogMobileStackOrder }, optional: true })
  mobileStackOrder?: BlogMobileStackOrder;

  @IsEnum({ enum: { BlogImageSize }, optional: true })
  imageSize?: BlogImageSize;

  @IsEnum({ enum: { BlogAspectRatio }, optional: true })
  aspectRatio?: BlogAspectRatio;

  @IsEnum({ enum: { BlogOverlayPosition }, optional: true })
  overlayPosition?: BlogOverlayPosition;

  @IsString({ optional: true })
  placeholderTitle?: string;

  @IsString({ optional: true })
  placeholderBody?: string;
}

/** Patch a block; `type` is immutable (absent). Nullable clears. */
export class PatchTemplateBlockDto {
  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsNumber({ type: 'integer', min: 1, max: 6, optional: true, nullable: true })
  headingLevel?: number | null;

  @IsEnum({ enum: { CalloutVariant }, optional: true, nullable: true })
  calloutVariant?: CalloutVariant | null;

  @IsEnum({ enum: { GalleryLayout }, optional: true, nullable: true })
  galleryLayout?: GalleryLayout | null;

  @IsEnum({ enum: { BlogMediaPosition }, optional: true, nullable: true })
  mediaPosition?: BlogMediaPosition | null;

  @IsEnum({ enum: { BlogMediaSplit }, optional: true, nullable: true })
  mediaSplit?: BlogMediaSplit | null;

  @IsEnum({ enum: { BlogMobileStackOrder }, optional: true, nullable: true })
  mobileStackOrder?: BlogMobileStackOrder | null;

  @IsEnum({ enum: { BlogImageSize }, optional: true, nullable: true })
  imageSize?: BlogImageSize | null;

  @IsEnum({ enum: { BlogAspectRatio }, optional: true, nullable: true })
  aspectRatio?: BlogAspectRatio | null;

  @IsEnum({ enum: { BlogOverlayPosition }, optional: true, nullable: true })
  overlayPosition?: BlogOverlayPosition | null;

  @IsString({ optional: true, nullable: true })
  placeholderTitle?: string | null;

  @IsString({ optional: true, nullable: true })
  placeholderBody?: string | null;
}

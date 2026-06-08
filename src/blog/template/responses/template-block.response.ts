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

export class TemplateBlockResponse {
  @IsString()
  id: string;

  @IsString()
  templateId: string;

  @IsEnum({ enum: { BlogSectionType } })
  type: BlogSectionType;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  headingLevel: number | null;

  @IsEnum({ enum: { CalloutVariant }, optional: true, nullable: true })
  calloutVariant: CalloutVariant | null;

  @IsEnum({ enum: { GalleryLayout }, optional: true, nullable: true })
  galleryLayout: GalleryLayout | null;

  @IsEnum({ enum: { BlogMediaPosition }, optional: true, nullable: true })
  mediaPosition: BlogMediaPosition | null;

  @IsEnum({ enum: { BlogMediaSplit }, optional: true, nullable: true })
  mediaSplit: BlogMediaSplit | null;

  @IsEnum({ enum: { BlogMobileStackOrder }, optional: true, nullable: true })
  mobileStackOrder: BlogMobileStackOrder | null;

  @IsEnum({ enum: { BlogImageSize }, optional: true, nullable: true })
  imageSize: BlogImageSize | null;

  @IsEnum({ enum: { BlogAspectRatio }, optional: true, nullable: true })
  aspectRatio: BlogAspectRatio | null;

  @IsEnum({ enum: { BlogOverlayPosition }, optional: true, nullable: true })
  overlayPosition: BlogOverlayPosition | null;

  @IsString({ optional: true, nullable: true })
  placeholderTitle: string | null;

  @IsString({ optional: true, nullable: true })
  placeholderBody: string | null;
}

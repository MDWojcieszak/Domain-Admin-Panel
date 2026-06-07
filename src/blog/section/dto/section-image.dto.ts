import {
  BlogAspectRatio,
  BlogImageSize,
  BlogOverlayBackdrop,
  BlogOverlayPosition,
  BlogOverlayTheme,
} from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class AddSectionImageDto {
  @IsString()
  imageId: string;

  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsEnum({ enum: { BlogImageSize }, optional: true })
  size?: BlogImageSize;

  @IsEnum({ enum: { BlogAspectRatio }, optional: true })
  aspectRatio?: BlogAspectRatio;

  @IsNumber({ optional: true, min: 0, max: 1 })
  focalX?: number;

  @IsNumber({ optional: true, min: 0, max: 1 })
  focalY?: number;

  @IsEnum({ enum: { BlogOverlayPosition }, optional: true })
  overlayPosition?: BlogOverlayPosition;

  @IsEnum({ enum: { BlogOverlayTheme }, optional: true })
  overlayTheme?: BlogOverlayTheme;

  @IsEnum({ enum: { BlogOverlayBackdrop }, optional: true })
  overlayBackdrop?: BlogOverlayBackdrop;
}

export class PatchSectionImageDto {
  @IsNumber({ type: 'integer', optional: true })
  order?: number;

  @IsEnum({ enum: { BlogImageSize }, optional: true })
  size?: BlogImageSize;

  @IsEnum({ enum: { BlogAspectRatio }, optional: true })
  aspectRatio?: BlogAspectRatio;

  @IsNumber({ optional: true, nullable: true, min: 0, max: 1 })
  focalX?: number | null;

  @IsNumber({ optional: true, nullable: true, min: 0, max: 1 })
  focalY?: number | null;

  @IsEnum({ enum: { BlogOverlayPosition }, optional: true, nullable: true })
  overlayPosition?: BlogOverlayPosition | null;

  @IsEnum({ enum: { BlogOverlayTheme }, optional: true, nullable: true })
  overlayTheme?: BlogOverlayTheme | null;

  @IsEnum({ enum: { BlogOverlayBackdrop }, optional: true, nullable: true })
  overlayBackdrop?: BlogOverlayBackdrop | null;
}

export class UpsertSectionImageTranslationDto {
  @IsString({ optional: true, nullable: true })
  caption?: string | null;

  @IsString({ optional: true, nullable: true })
  alt?: string | null;

  @IsString({ optional: true, nullable: true })
  overlayText?: string | null;
}

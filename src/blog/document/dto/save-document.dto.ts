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
  CalloutVariant,
  EmbedProvider,
  GalleryLayout,
} from '@prisma/client';
import { IsEnum, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

/**
 * Provider-neutral block type (NOT BlockNote JSON). Maps 1:1 to BlogSectionType
 * server-side. Under the "prose = Markdown in PARAGRAPH" model the editor emits
 * headings/lists/quotes as `prose`, but all 12 types are accepted.
 */
export enum DocumentBlockType {
  prose = 'prose',
  callout = 'callout',
  divider = 'divider',
  image = 'image',
  gallery = 'gallery',
  mediaText = 'mediaText',
  embed = 'embed',
  map = 'map',
  place = 'place',
  list = 'list',
  heading = 'heading',
  quote = 'quote',
}

export class DocumentListItemInputDto {
  @IsString({ optional: true, nullable: true })
  content?: string | null;
}

/**
 * One document block. Permissive shape (all fields optional bar `type`); the
 * service validates the per-type required fields and maps to a relational
 * section. Text fields are written for `?locale`; everything else is neutral.
 */
export class DocumentBlockDto {
  @IsString({ optional: true, description: 'Existing sectionId (update).' })
  id?: string;

  @IsString({ optional: true, description: 'Client key for a new block.' })
  clientKey?: string;

  @IsEnum({ enum: { DocumentBlockType } })
  type: DocumentBlockType;

  // --- text (per-locale) ---
  @IsString({
    optional: true,
    nullable: true,
    description: 'Markdown body (prose/callout/mediaText/quote).',
  })
  markdown?: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'Heading text (heading block).',
  })
  text?: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'Caption for a single-image block (image/mediaText).',
  })
  caption?: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'Alt text for a single-image block (per-locale).',
  })
  alt?: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'Overlay text rendered on the image (per-locale).',
  })
  overlayText?: string | null;

  // --- neutral / relations ---
  @IsEnum({ enum: { CalloutVariant }, optional: true })
  variant?: CalloutVariant;

  @IsString({ optional: true })
  imageId?: string;

  @IsString({ isArray: true, optional: true })
  imageIds?: string[];

  @IsEnum({ enum: { GalleryLayout }, optional: true })
  galleryLayout?: GalleryLayout;

  @IsEnum({ enum: { BlogImageSize }, optional: true })
  imageSize?: BlogImageSize;

  @IsEnum({ enum: { BlogAspectRatio }, optional: true })
  aspectRatio?: BlogAspectRatio;

  @IsNumber({
    optional: true,
    min: 0,
    max: 1,
    description: 'Focal point X, 0..1 (left→right). image/mediaText only.',
  })
  focalX?: number;

  @IsNumber({
    optional: true,
    min: 0,
    max: 1,
    description: 'Focal point Y, 0..1 (top→bottom).',
  })
  focalY?: number;

  @IsEnum({ enum: { BlogOverlayPosition }, optional: true })
  overlayPosition?: BlogOverlayPosition;

  @IsEnum({ enum: { BlogOverlayTheme }, optional: true })
  overlayTheme?: BlogOverlayTheme;

  @IsEnum({ enum: { BlogOverlayBackdrop }, optional: true })
  overlayBackdrop?: BlogOverlayBackdrop;

  @IsEnum({ enum: { BlogMediaPosition }, optional: true })
  mediaPosition?: BlogMediaPosition;

  @IsEnum({ enum: { BlogMediaSplit }, optional: true })
  mediaSplit?: BlogMediaSplit;

  @IsEnum({ enum: { BlogMobileStackOrder }, optional: true })
  mobileStackOrder?: BlogMobileStackOrder;

  @IsEnum({ enum: { EmbedProvider }, optional: true })
  provider?: EmbedProvider;

  @IsString({ optional: true })
  url?: string;

  @IsString({ optional: true })
  poiId?: string;

  @IsString({ isArray: true, optional: true })
  poiIds?: string[];

  @IsNumber({ type: 'integer', optional: true, min: 1, max: 3 })
  level?: number;

  @IsString({ optional: true, nullable: true })
  author?: string | null;

  @IsNested({ type: DocumentListItemInputDto, isArray: true, optional: true })
  items?: DocumentListItemInputDto[];

  @IsEnum({
    enum: { BlogAccessTier },
    optional: true,
    description: 'Per-section paywall tier (defaults to PUBLIC on create).',
  })
  minAccessTier?: BlogAccessTier;
}

export class SaveDocumentDto {
  @IsNested({ type: DocumentBlockDto, isArray: true })
  blocks: DocumentBlockDto[];
}

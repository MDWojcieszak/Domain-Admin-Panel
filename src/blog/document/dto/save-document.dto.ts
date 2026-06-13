import {
  BlogAccessTier,
  BlogAspectRatio,
  BlogImageSize,
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
 * server-side. Under "prose = Markdown in PARAGRAPH" the editor emits
 * headings/lists/quotes as `prose`, but all types are accepted. `columns` is a
 * layout container (see DocumentColumnDto).
 */
export enum DocumentBlockType {
  prose = 'prose',
  callout = 'callout',
  divider = 'divider',
  image = 'image',
  gallery = 'gallery',
  embed = 'embed',
  map = 'map',
  place = 'place',
  list = 'list',
  heading = 'heading',
  quote = 'quote',
  columns = 'columns',
}

export class DocumentListItemInputDto {
  @IsString({ optional: true, nullable: true })
  content?: string | null;
}

/**
 * A leaf block — everything except `columns`. Used both at the top level and
 * inside a column. Permissive shape; the service validates per-type and maps to
 * a relational section. Text fields are written for `?locale`; the rest neutral.
 */
export class DocumentLeafBlockDto {
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
    description: 'Markdown body (prose/callout/quote).',
  })
  markdown?: string | null;

  @IsString({ optional: true, nullable: true, description: 'Heading text.' })
  text?: string | null;

  @IsString({
    optional: true,
    nullable: true,
    description: 'Caption for a single-image block (image).',
  })
  caption?: string | null;

  @IsString({ optional: true, nullable: true })
  alt?: string | null;

  @IsString({ optional: true, nullable: true })
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

/** One column: a relative width and the leaf blocks it holds (no nested columns). */
export class DocumentColumnDto {
  @IsString({ optional: true })
  id?: string;

  @IsString({ optional: true })
  clientKey?: string;

  @IsNumber({
    optional: true,
    min: 0,
    max: 1,
    description: 'Column width share, 0..1 (relative; FE normalizes).',
  })
  width?: number;

  @IsNested({ type: DocumentLeafBlockDto, isArray: true })
  blocks: DocumentLeafBlockDto[];
}

/** A top-level block: a leaf, or a `columns` layout carrying its columns. */
export class DocumentBlockDto extends DocumentLeafBlockDto {
  @IsNested({ type: DocumentColumnDto, isArray: true, optional: true })
  columns?: DocumentColumnDto[];
}

export class SaveDocumentDto {
  @IsNested({ type: DocumentBlockDto, isArray: true })
  blocks: DocumentBlockDto[];
}

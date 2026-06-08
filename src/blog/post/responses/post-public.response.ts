import {
  BlogAccessTier,
  BlogPostStatus,
  BlogSectionType,
} from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { PostAuthorResponse } from './post-author.response';
import { ResolvedSectionResponse } from './post-draft.response';

/** A section the viewer is allowed to see (full resolved content). */
export class VisibleSectionResponse extends ResolvedSectionResponse {
  @IsBoolean()
  locked: false;
}

/**
 * Placeholder for a paywalled section. Carries NO content — only enough for the
 * front end to render an unlock prompt.
 */
export class LockedSectionResponse {
  @IsString()
  id: string;

  @IsEnum({ enum: { BlogSectionType } })
  type: BlogSectionType;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsEnum({ enum: { BlogAccessTier } })
  minAccessTier: BlogAccessTier;

  /** Tier the viewer needs to unlock this section. */
  @IsEnum({ enum: { BlogAccessTier } })
  requiredTier: BlogAccessTier;

  @IsBoolean()
  locked: true;
}

export type PublicSectionResponse =
  | VisibleSectionResponse
  | LockedSectionResponse;

export class HreflangAlternateResponse {
  @IsString()
  locale: string;

  @IsString()
  canonicalUrl: string;
}

/**
 * Public read of a published post, resolved to one locale, with the paywall
 * applied: gated sections are replaced by locked placeholders and, when the
 * whole post is above the viewer's tier, `isTeaser` is set.
 */
export class PublicPostResponse {
  @IsString()
  postId: string;

  @IsString()
  slug: string;

  @IsEnum({ enum: { BlogPostStatus } })
  status: BlogPostStatus;

  @IsEnum({ enum: { BlogAccessTier } })
  accessTier: BlogAccessTier;

  @IsString()
  locale: string;

  /** True when the whole post is above the viewer's tier (teaser view). */
  @IsBoolean()
  isTeaser: boolean;

  @IsString()
  versionId: string;

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

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  readingMinutes: number | null;

  @IsString({ optional: true, nullable: true })
  metaTitle: string | null;

  @IsString({ optional: true, nullable: true })
  metaDescription: string | null;

  @IsString({ optional: true, nullable: true })
  canonicalUrl: string | null;

  @IsString({ isArray: true })
  seoKeywords: string[];

  @IsBoolean()
  untranslated: boolean;

  @IsNested({ type: HreflangAlternateResponse, isArray: true })
  hreflangs: HreflangAlternateResponse[];

  @IsNested({ type: PostAuthorResponse, isArray: true })
  authors: PostAuthorResponse[];

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  firstPublishedAt: Date | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  lastPublishedAt: Date | null;

  @IsNested({ type: VisibleSectionResponse, isArray: true })
  sections: PublicSectionResponse[];
}

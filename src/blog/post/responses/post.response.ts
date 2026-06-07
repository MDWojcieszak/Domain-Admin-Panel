import { BlogAccessTier, BlogPostStatus } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { PostAuthorResponse } from './post-author.response';

/**
 * Post summary for the editorial panel (meta + version pointers, no rendered
 * content). Full draft content comes from GET /blog/posts/:id/draft.
 */
export class PostResponse {
  @IsString()
  id: string;

  @IsString()
  slug: string;

  @IsEnum({ enum: { BlogPostStatus } })
  status: BlogPostStatus;

  @IsEnum({ enum: { BlogAccessTier } })
  accessTier: BlogAccessTier;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order: number | null;

  @IsNumber({ type: 'integer' })
  viewCount: number;

  @IsNumber({ type: 'integer' })
  likeCount: number;

  @IsNumber({ type: 'integer' })
  helpfulCount: number;

  @IsNumber({ type: 'integer' })
  notHelpfulCount: number;

  @IsString()
  createdById: string;

  @IsString({ optional: true, nullable: true })
  seriesId: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  seriesOrder: number | null;

  @IsString({ optional: true, nullable: true })
  draftVersionId: string | null;

  @IsString({ optional: true, nullable: true })
  publishedVersionId: string | null;

  /** True when the draft differs from the published version (or never published). */
  @IsBoolean()
  hasUnpublishedChanges: boolean;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  firstPublishedAt: Date | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  lastPublishedAt: Date | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  scheduledFor: Date | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  archivedAt: Date | null;

  @IsNested({ type: PostAuthorResponse, isArray: true })
  authors: PostAuthorResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

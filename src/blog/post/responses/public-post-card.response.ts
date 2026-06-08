import { BlogAccessTier } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { PostAuthorResponse } from './post-author.response';

/** Card for the public feed (meta only — never any gated body). */
export class PublicPostCardResponse {
  @IsString()
  id: string;

  @IsString()
  slug: string;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsString({ optional: true, nullable: true })
  excerpt: string | null;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  /** Lets the FE badge premium; safe because the card carries no body. */
  @IsEnum({ enum: { BlogAccessTier } })
  accessTier: BlogAccessTier;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  readingMinutes: number | null;

  @IsString({ isArray: true })
  categoryIds: string[];

  @IsBoolean()
  untranslated: boolean;

  @IsNested({ type: PostAuthorResponse, isArray: true })
  authors: PostAuthorResponse[];

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  firstPublishedAt: Date | null;
}

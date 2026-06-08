import { BlogAccessTier } from '@prisma/client';
import {
  IsBoolean,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

export class SearchResultResponse {
  @IsString()
  postSlug: string;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  /** Teaser excerpt. NULL when the result is locked (viewer below the post tier). */
  @IsString({ optional: true, nullable: true })
  excerpt: string | null;

  /** Reader-access tier required to open the post. */
  @IsEnum({ enum: { BlogAccessTier } })
  accessTier: BlogAccessTier;

  /** True when the viewer's tier is below `accessTier` (excerpt withheld). */
  @IsBoolean()
  locked: boolean;

  @IsNumber()
  rank: number;
}

export class SearchResultsResponse {
  @IsNested({ type: SearchResultResponse, isArray: true })
  results: SearchResultResponse[];

  @IsNumber({ type: 'integer' })
  total: number;

  /** The resolved locale actually searched (may differ from the requested one). */
  @IsString()
  locale: string;
}

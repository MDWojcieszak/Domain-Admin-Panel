import { HomeBlockType } from '@prisma/client';
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { PublicPostCardResponse } from '../../post/responses';
import { PoiPublicResponse } from '../../poi/responses';
import { ResolvedCategoryResponse } from '../../category/responses';

/**
 * A homepage block resolved for one locale. Flat union by `type`: per-type
 * fields are only populated for the relevant type (mirrors PublicSectionResponse).
 * All embedded posts are public cards of PUBLISHED posts; POIs are public-safe.
 */
export class ResolvedHomeBlockResponse {
  @IsString()
  id: string;

  @IsEnum({ enum: { HomeBlockType } })
  type: HomeBlockType;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsString({ optional: true, nullable: true })
  imageId: string | null;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsString({ optional: true, nullable: true })
  body: string | null;

  @IsBoolean()
  untranslated: boolean;

  /** HERO / FEATURED_POSTS / CATEGORY_ROW / POST_GRID. */
  @IsNested({
    type: PublicPostCardResponse,
    isArray: true,
    optional: true,
    nullable: true,
  })
  posts: PublicPostCardResponse[] | null;

  /** CATEGORY_ROW only. */
  @IsNested({ type: ResolvedCategoryResponse, optional: true, nullable: true })
  category: ResolvedCategoryResponse | null;

  /** MAP only. */
  @IsNested({
    type: PoiPublicResponse,
    isArray: true,
    optional: true,
    nullable: true,
  })
  pois: PoiPublicResponse[] | null;
}

export class ResolvedHomeResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsNested({ type: ResolvedHomeBlockResponse, isArray: true })
  blocks: ResolvedHomeBlockResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

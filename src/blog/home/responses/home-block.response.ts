import { HomeBlockType } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { HomeBlockPostResponse } from './home-block-post.response';

export class HomeBlockTranslationResponse {
  @IsString()
  locale: string;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsString({ optional: true, nullable: true })
  body: string | null;
}

/** Admin block: raw, all locales + all curated posts (any status). */
export class HomeBlockResponse {
  @IsString()
  id: string;

  @IsString()
  layoutId: string;

  @IsEnum({ enum: { HomeBlockType } })
  type: HomeBlockType;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsString({ optional: true, nullable: true })
  categoryId: string | null;

  @IsString({ optional: true, nullable: true })
  imageId: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  limit: number | null;

  @IsNested({ type: HomeBlockTranslationResponse, isArray: true })
  translations: HomeBlockTranslationResponse[];

  @IsNested({ type: HomeBlockPostResponse, isArray: true })
  posts: HomeBlockPostResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

import { IsDate, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

import { BlogMediaImageResponse } from './media-image.response';

export class BlogMediaAlbumItemResponse {
  @IsString()
  id: string;

  @IsNumber({ type: 'integer' })
  order: number;

  @IsNested({ type: BlogMediaImageResponse })
  image: BlogMediaImageResponse;
}

/** Album list card (no items, just the count + cover). */
export class BlogMediaAlbumSummaryResponse {
  @IsString()
  id: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsString()
  createdById: string;

  @IsNumber({ type: 'integer' })
  itemCount: number;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

/** Full album with its ordered items. */
export class BlogMediaAlbumResponse extends BlogMediaAlbumSummaryResponse {
  @IsNested({ type: BlogMediaAlbumItemResponse, isArray: true })
  items: BlogMediaAlbumItemResponse[];
}

export class BlogMediaAlbumListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: BlogMediaAlbumSummaryResponse, isArray: true })
  albums: BlogMediaAlbumSummaryResponse[];
}

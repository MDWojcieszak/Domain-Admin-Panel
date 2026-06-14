import { IsBoolean, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

import { PoiPublicResponse } from '../../poi/responses';

export class PublicCollectionItemResponse {
  @IsNumber({ type: 'integer' })
  rank: number;

  @IsNested({ type: PoiPublicResponse })
  poi: PoiPublicResponse;
}

/**
 * Lightweight public collection card (list view). No items, no `isPublic`.
 * `country` is the country slug (resolve the name from the country menu).
 */
export class PublicCollectionSummaryResponse {
  @IsString()
  id: string;

  @IsString()
  slug: string;

  @IsString({ optional: true, nullable: true })
  country: string | null;

  @IsString({ optional: true, nullable: true })
  region: string | null;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsNumber({ type: 'integer' })
  itemCount: number;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsBoolean()
  untranslated: boolean;
}

export class PublicCollectionListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: PublicCollectionSummaryResponse, isArray: true })
  collections: PublicCollectionSummaryResponse[];
}

/**
 * Public ranked collection. Has NO `isPublic` field (only public collections are
 * ever returned). Embedded POIs use the shared public projection.
 */
export class PublicCollectionResponse {
  @IsString()
  id: string;

  @IsString()
  slug: string;

  @IsString({ optional: true, nullable: true })
  country: string | null;

  @IsString({ optional: true, nullable: true })
  region: string | null;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsString({ optional: true, nullable: true })
  description: string | null;

  @IsBoolean()
  untranslated: boolean;

  @IsNested({ type: PublicCollectionItemResponse, isArray: true })
  items: PublicCollectionItemResponse[];
}

import { IsBoolean, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

import { PoiPublicResponse } from '../../poi/responses';

export class PublicCollectionItemResponse {
  @IsNumber({ type: 'integer' })
  rank: number;

  @IsNested({ type: PoiPublicResponse })
  poi: PoiPublicResponse;
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

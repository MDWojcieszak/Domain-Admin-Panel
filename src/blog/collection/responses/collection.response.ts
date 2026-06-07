import {
  IsBoolean,
  IsDate,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

export class CollectionTranslationResponse {
  @IsString()
  locale: string;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsString({ optional: true, nullable: true })
  description: string | null;
}

export class CollectionItemAdminResponse {
  @IsString()
  id: string;

  @IsString()
  poiId: string;

  @IsNumber({ type: 'integer' })
  rank: number;

  /** Canonical POI name (identifier for the editor). */
  @IsString()
  poiName: string;
}

/** Full admin collection (all locales + items, incl. isPublic). */
export class CollectionResponse {
  @IsString()
  id: string;

  @IsString()
  slug: string;

  @IsString({ optional: true, nullable: true })
  country: string | null;

  @IsString({ optional: true, nullable: true })
  region: string | null;

  @IsBoolean()
  isPublic: boolean;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsNested({ type: CollectionTranslationResponse, isArray: true })
  translations: CollectionTranslationResponse[];

  @IsNested({ type: CollectionItemAdminResponse, isArray: true })
  items: CollectionItemAdminResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

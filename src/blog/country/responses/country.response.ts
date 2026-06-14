import { IsDate, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class BlogCountryTranslationResponse {
  @IsString()
  locale: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  intro: string | null;
}

/** Admin view of a country — all fields + every locale + content counts. */
export class BlogCountryAdminResponse {
  @IsString()
  id: string;

  @IsString()
  slug: string;

  @IsString({ optional: true, nullable: true })
  code: string | null;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order: number | null;

  @IsNumber({ type: 'integer' })
  postCount: number;

  @IsNumber({ type: 'integer' })
  poiCount: number;

  @IsNumber({ type: 'integer' })
  collectionCount: number;

  @IsNested({ type: BlogCountryTranslationResponse, isArray: true })
  translations: BlogCountryTranslationResponse[];

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class BlogCountryListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: BlogCountryAdminResponse, isArray: true })
  countries: BlogCountryAdminResponse[];
}

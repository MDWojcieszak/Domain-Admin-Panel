import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

/** One item in the global country navigation (resolved to a locale). */
export class BlogCountryMenuItemResponse {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsNumber({ type: 'integer' })
  postCount: number;

  @IsNumber({ type: 'integer' })
  poiCount: number;
}

export class BlogCountryMenuResponse {
  @IsNested({ type: BlogCountryMenuItemResponse, isArray: true })
  countries: BlogCountryMenuItemResponse[];
}

/** Country page header (resolved). Lists are fetched via `?country=<slug>`. */
export class BlogCountryPageResponse {
  @IsString()
  slug: string;

  @IsString()
  name: string;

  @IsString({ optional: true, nullable: true })
  intro: string | null;

  @IsString({ optional: true, nullable: true })
  coverImageId: string | null;

  @IsNumber({ type: 'integer' })
  postCount: number;

  @IsNumber({ type: 'integer' })
  poiCount: number;
}

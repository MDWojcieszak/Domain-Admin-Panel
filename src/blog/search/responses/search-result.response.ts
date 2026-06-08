import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class SearchResultResponse {
  @IsString()
  postSlug: string;

  @IsString({ optional: true, nullable: true })
  title: string | null;

  @IsString({ optional: true, nullable: true })
  excerpt: string | null;

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

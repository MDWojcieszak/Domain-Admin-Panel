import { IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class BlogCountryResponse {
  @IsString({ description: 'Language-neutral country value.' })
  country: string;

  @IsNumber({ type: 'integer' })
  postCount: number;

  @IsNumber({ type: 'integer' })
  poiCount: number;
}

export class BlogCountriesResponse {
  @IsNested({ type: BlogCountryResponse, isArray: true })
  countries: BlogCountryResponse[];
}

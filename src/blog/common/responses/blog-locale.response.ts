import { IsBoolean, IsNested, IsNumber, IsString } from 'nestjs-swagger-dto';

export class BlogLocaleResponse {
  @IsString()
  code: string;

  @IsString()
  name: string;

  @IsBoolean()
  isDefault: boolean;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order: number | null;
}

export class BlogLocaleListResponse {
  @IsString()
  defaultLocale: string;

  @IsNested({ type: BlogLocaleResponse, isArray: true })
  locales: BlogLocaleResponse[];
}

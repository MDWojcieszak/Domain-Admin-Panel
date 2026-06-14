import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class PatchBlogCountryDto {
  @IsString({ optional: true })
  slug?: string;

  @IsString({ optional: true, nullable: true })
  code?: string | null;

  @IsString({ optional: true, nullable: true })
  coverImageId?: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order?: number | null;
}

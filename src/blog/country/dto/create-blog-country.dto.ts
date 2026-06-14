import { IsNumber, IsString } from 'nestjs-swagger-dto';

export class CreateBlogCountryDto {
  @IsString({ description: 'Canonical key (normalized lowercase).' })
  slug: string;

  @IsString({
    optional: true,
    nullable: true,
    description: 'ISO-3166-1 alpha-2.',
  })
  code?: string | null;

  @IsString({ optional: true, nullable: true })
  coverImageId?: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order?: number | null;

  // --- optional initial translation ---
  @IsString({
    optional: true,
    description:
      'Locale for the initial name/intro; defaults to default locale.',
  })
  locale?: string;

  @IsString({ optional: true, description: 'Localized country name.' })
  name?: string;

  @IsString({ optional: true, nullable: true })
  intro?: string | null;
}

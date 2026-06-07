import { IsBoolean, IsString } from 'nestjs-swagger-dto';

export class CreateCollectionDto {
  @IsString({ description: 'Unique slug.' })
  slug: string;

  @IsString({ description: 'Title for the initial locale.' })
  title: string;

  @IsString({
    optional: true,
    description: 'Initial locale. Defaults to the default locale.',
  })
  locale?: string;

  @IsString({ optional: true })
  description?: string;

  @IsString({ optional: true, nullable: true, description: 'Scope country.' })
  country?: string | null;

  @IsString({ optional: true, nullable: true, description: 'Scope region.' })
  region?: string | null;

  @IsBoolean({
    optional: true,
    description: 'Public (blog) vs internal (planning). Default true.',
  })
  isPublic?: boolean;

  @IsString({ optional: true, nullable: true })
  coverImageId?: string | null;
}

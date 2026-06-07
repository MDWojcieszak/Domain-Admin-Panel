import { BlogAccessTier } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CreatePostDto {
  @IsString({ description: 'Unique URL slug for the post.' })
  slug: string;

  @IsString({
    description:
      'Title for the initial locale (default locale unless `locale` is set).',
  })
  title: string;

  @IsString({
    optional: true,
    description:
      'Locale of the initial content. Defaults to the default BlogLocale.',
  })
  locale?: string;

  @IsString({ optional: true })
  subtitle?: string;

  @IsString({ optional: true })
  excerpt?: string;

  @IsEnum({ enum: { BlogAccessTier }, optional: true })
  accessTier?: BlogAccessTier;

  @IsString({ optional: true })
  country?: string;

  @IsString({ optional: true })
  region?: string;

  @IsString({ optional: true })
  coverImageId?: string;

  @IsString({ optional: true })
  ogImageId?: string;

  @IsString({ optional: true })
  seriesId?: string;

  @IsNumber({ type: 'integer', optional: true })
  seriesOrder?: number;
}

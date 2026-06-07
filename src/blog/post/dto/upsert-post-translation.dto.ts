import { IsString } from 'nestjs-swagger-dto';

/**
 * Upserts the draft version's translation for one locale (locale comes from the
 * URL). All fields optional; nullable ones accept null to clear.
 */
export class UpsertPostTranslationDto {
  @IsString({ optional: true, nullable: true })
  title?: string | null;

  @IsString({ optional: true, nullable: true })
  subtitle?: string | null;

  @IsString({ optional: true, nullable: true })
  excerpt?: string | null;

  @IsString({ isArray: true, optional: true })
  seoKeywords?: string[];

  @IsString({ optional: true, nullable: true })
  metaTitle?: string | null;

  @IsString({ optional: true, nullable: true })
  metaDescription?: string | null;

  @IsString({ optional: true, nullable: true })
  canonicalUrl?: string | null;
}

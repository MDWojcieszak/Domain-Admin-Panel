import { BlogAccessTier } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

/**
 * Patches language-neutral fields of the post and its draft version. Localized
 * text is edited separately via PUT /blog/posts/:id/translations/:locale.
 * Nullable fields accept null to clear them.
 */
export class PatchPostDto {
  // --- post-level ---
  @IsString({ optional: true })
  slug?: string;

  @IsEnum({ enum: { BlogAccessTier }, optional: true })
  accessTier?: BlogAccessTier;

  @IsString({ optional: true, nullable: true })
  seriesId?: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  seriesOrder?: number | null;

  // --- draft version (language-neutral) ---
  @IsString({ optional: true, nullable: true })
  country?: string | null;

  @IsString({ optional: true, nullable: true })
  region?: string | null;

  @IsString({ optional: true, nullable: true })
  coverImageId?: string | null;

  @IsString({ optional: true, nullable: true })
  ogImageId?: string | null;
}

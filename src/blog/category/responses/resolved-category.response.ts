import { CategoryKind } from '@prisma/client';
import { IsBoolean, IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

/**
 * Locale-resolved category shape (public-safe). Deliberately omits isSystem,
 * raw translations and timestamps so it can back a future public route.
 */
export class ResolvedCategoryResponse {
  @IsString()
  id: string;

  @IsEnum({ enum: { CategoryKind } })
  kind: CategoryKind;

  @IsString()
  key: string;

  @IsString({ optional: true, nullable: true })
  icon: string | null;

  @IsString({ optional: true, nullable: true })
  color: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order: number | null;

  @IsString({ optional: true, nullable: true })
  label: string | null;

  @IsBoolean()
  untranslated: boolean;
}

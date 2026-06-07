import { CategoryKind } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

export class CreateCategoryDto {
  @IsEnum({ enum: { CategoryKind } })
  kind: CategoryKind;

  @IsString({
    description: 'Canonical, language-neutral key (normalized server-side).',
  })
  key: string;

  @IsString({ optional: true, nullable: true })
  icon?: string | null;

  @IsString({ optional: true, nullable: true })
  color?: string | null;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  order?: number | null;

  // --- optional initial translation ---
  @IsString({
    optional: true,
    description:
      'Locale for the initial label. Defaults to the default locale.',
  })
  locale?: string;

  @IsString({ optional: true })
  label?: string;
}

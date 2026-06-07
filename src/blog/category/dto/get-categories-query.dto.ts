import { CategoryKind } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

export enum CategoryListView {
  ADMIN = 'ADMIN',
  RESOLVED = 'RESOLVED',
}

/** Not paginated — the category catalog is small. */
export class GetCategoriesQueryDto {
  @IsEnum({ enum: { CategoryKind }, optional: true })
  kind?: CategoryKind;

  @IsEnum({
    enum: { CategoryListView },
    optional: true,
    description:
      'ADMIN (default, all locales) or RESOLVED (single label per locale).',
  })
  view?: CategoryListView;

  @IsString({ optional: true, description: 'Locale used when view=RESOLVED.' })
  locale?: string;
}

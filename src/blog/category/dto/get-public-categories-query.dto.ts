import { CategoryKind } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

/** Public category list query — always locale-resolved. */
export class GetPublicCategoriesQueryDto {
  @IsEnum({
    enum: { CategoryKind },
    optional: true,
    description: 'Filter by kind: POST (post chips) or ATTRACTION (POI).',
  })
  kind?: CategoryKind;

  @IsString({ optional: true })
  locale?: string;
}

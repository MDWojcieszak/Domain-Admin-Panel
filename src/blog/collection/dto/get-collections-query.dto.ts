import { Transform } from 'class-transformer';
import { IsBoolean, IsString } from 'nestjs-swagger-dto';

import { PaginationDto } from '../../../common/dto/pagination.dto';
import { toBoolean } from '../../../common/helpers/cast.helper';

export class GetCollectionsQueryDto extends PaginationDto {
  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({ optional: true })
  isPublic?: boolean;

  @IsString({ optional: true, description: 'Country slug filter.' })
  country?: string;

  @IsString({ optional: true })
  region?: string;

  @IsString({
    optional: true,
    description: 'Slug contains (case-insensitive).',
  })
  search?: string;
}

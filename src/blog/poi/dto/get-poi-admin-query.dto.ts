import { PoiStatus } from '@prisma/client';
import { IsEnum, IsString } from 'nestjs-swagger-dto';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class GetPoiAdminQueryDto extends PaginationDto {
  @IsEnum({ enum: { PoiStatus }, optional: true })
  status?: PoiStatus;

  @IsString({ optional: true, description: 'Category id or key (ATTRACTION).' })
  category?: string;

  @IsString({ optional: true })
  region?: string;

  @IsString({ optional: true })
  country?: string;

  @IsString({
    optional: true,
    description: 'Name contains (case-insensitive).',
  })
  search?: string;
}

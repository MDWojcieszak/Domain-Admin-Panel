import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'nestjs-swagger-dto';

import { toNumber } from '../../../common/helpers/cast.to-number';

/** Public collection list query. Country/region are scope filters (slug for country). */
export class GetPublicCollectionsQueryDto {
  @IsString({ optional: true, description: 'Country slug filter.' })
  country?: string;

  @IsString({ optional: true, description: 'Region scope filter.' })
  region?: string;

  @IsString({ optional: true })
  locale?: string;

  @Transform(({ value }) => toNumber(value, { default: 50, min: 1, max: 100 }))
  @IsNumber({ optional: true })
  take?: number;

  @Transform(({ value }) => toNumber(value, { default: 0, min: 0 }))
  @IsNumber({ optional: true })
  skip?: number;
}

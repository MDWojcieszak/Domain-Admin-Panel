import { Transform } from 'class-transformer';
import { IsBoolean, IsNumber, IsString } from 'nestjs-swagger-dto';

import { toNumber } from '../../../common/helpers/cast.to-number';
import { toBoolean } from '../../../common/helpers/cast.helper';

/**
 * Public map query. Deliberately does NOT extend PaginationDto — a map needs a
 * larger page than the admin cap of 20.
 */
export class GetPoiMapQueryDto {
  @IsString({ optional: true, description: 'Category id or key (ATTRACTION).' })
  category?: string;

  @IsString({ optional: true })
  region?: string;

  @IsString({ optional: true })
  country?: string;

  @IsString({ optional: true })
  locale?: string;

  @Transform(({ value }) => toBoolean(value))
  @IsBoolean({
    optional: true,
    description: 'Include PERMANENTLY_CLOSED POIs.',
  })
  includeClosed?: boolean;

  @Transform(({ value }) => toNumber(value, { default: 100, min: 1, max: 200 }))
  @IsNumber({ optional: true })
  take?: number;

  @Transform(({ value }) => toNumber(value, { default: 0, min: 0 }))
  @IsNumber({ optional: true })
  skip?: number;
}

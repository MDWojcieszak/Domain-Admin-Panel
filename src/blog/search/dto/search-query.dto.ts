import { Transform } from 'class-transformer';
import { IsNumber, IsString } from 'nestjs-swagger-dto';

import { toNumber } from '../../../common/helpers/cast.to-number';

export class SearchQueryDto {
  @IsString({ minLength: 2, maxLength: 500, description: 'Search terms.' })
  q: string;

  @IsString({ optional: true })
  locale?: string;

  @Transform(({ value }) => toNumber(value, { default: 20, min: 1, max: 100 }))
  @IsNumber({ optional: true })
  take?: number;

  @Transform(({ value }) => toNumber(value, { default: 0, min: 0 }))
  @IsNumber({ optional: true })
  skip?: number;
}

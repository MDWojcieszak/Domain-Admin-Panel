import { Transform } from 'class-transformer';
import { IsNumber } from 'nestjs-swagger-dto';
import { toNumber } from '../../common/helpers/cast.to-number';

export class PaginationDto {
  @Transform(({ value }) => toNumber(value))
  @IsNumber({ min: 1, max: 20 })
  take: number;

  @Transform(({ value }) => toNumber(value))
  @IsNumber({ optional: true, default: 0, min: 0 })
  skip?: number;
}

import { GearCategory, GearOwnership } from '@prisma/client';
import { Transform } from 'class-transformer';
import { IsEnum, IsNumber } from 'nestjs-swagger-dto';

import { toNumber } from '../../common/helpers/cast.to-number';

export enum GearItemsSort {
  /** Curated portfolio order: category, then `order`. */
  DEFAULT = 'DEFAULT',
  /** Soonest `neededBy` first, undated last; `priority` breaks ties (§4). */
  NEEDED_BY = 'NEEDED_BY',
}

/**
 * One view serves both questions from §4: `ownership=WISHLIST&sort=NEEDED_BY`
 * is the shopping plan, `ownership=OWNED&sort=NEEDED_BY` is "what do I need
 * soon".
 */
export class GetGearItemsQueryDto {
  @IsEnum({ enum: { GearOwnership }, optional: true })
  ownership?: GearOwnership;

  @IsEnum({ enum: { GearCategory }, optional: true })
  category?: GearCategory;

  @IsEnum({ enum: { GearItemsSort }, optional: true })
  sort?: GearItemsSort;

  /** Only gear needed within this many days from today (inclusive). */
  @Transform(({ value }) => toNumber(value, { min: 0 }))
  @IsNumber({ type: 'integer', min: 0, optional: true })
  neededWithinDays?: number;
}

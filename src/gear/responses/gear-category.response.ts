import { GearCategory } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

import { GearMediaSource } from '../gear-media-source';

/** One category with what it implies, for the gear form's select. */
export class GearCategoryResponse {
  @IsEnum({ enum: { GearCategory } })
  category: GearCategory;

  @IsEnum({ enum: { GearMediaSource } })
  mediaSource: GearMediaSource;

  /** What the securing checklist tells you to do; null when nothing to secure. */
  @IsString({ optional: true, nullable: true })
  secureAction: string | null;

  /** Days before unsecured material is flagged; null when nothing to secure. */
  @IsNumber({ type: 'integer', optional: true, nullable: true })
  reminderDays: number | null;
}

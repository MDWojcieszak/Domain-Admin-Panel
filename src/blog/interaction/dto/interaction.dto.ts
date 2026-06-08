import { Transform } from 'class-transformer';
import { BlogFeedbackRating } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

import { toNumber } from '../../../common/helpers/cast.to-number';

export class UpsertFeedbackDto {
  @IsEnum({ enum: { BlogFeedbackRating } })
  rating: BlogFeedbackRating;

  @IsString({ optional: true, nullable: true, maxLength: 500 })
  comment?: string | null;
}

export class InsightsQueryDto {
  @Transform(({ value }) => toNumber(value, { default: 20, min: 1, max: 100 }))
  @IsNumber({ optional: true, description: 'Recent feedback rows (1–100).' })
  recentFeedbackLimit?: number;
}

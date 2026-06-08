import { BlogAccessTier } from '@prisma/client';
import { IsEnum, IsNumber, IsString } from 'nestjs-swagger-dto';

import { PaginationDto } from '../../../common/dto/pagination.dto';

export class CreateCodeDto {
  @IsString({
    optional: true,
    description: 'Auto-generated when omitted; normalized.',
  })
  code?: string;

  @IsEnum({ enum: { BlogAccessTier }, optional: true })
  tier?: BlogAccessTier;

  @IsNumber({
    type: 'integer',
    min: 1,
    max: 36500,
    optional: true,
    nullable: true,
    description: 'Access length in days after redemption; null = unlimited.',
  })
  durationDays?: number | null;

  @IsString({
    isDate: { format: 'date-time' },
    optional: true,
    nullable: true,
    description: 'Code usable until this instant.',
  })
  expiresAt?: string | null;
}

export class RedeemCodeDto {
  @IsString()
  code: string;
}

export class GetCodesQueryDto extends PaginationDto {}

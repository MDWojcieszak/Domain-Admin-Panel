import { BlogAccessTier } from '@prisma/client';
import {
  IsDate,
  IsEnum,
  IsNested,
  IsNumber,
  IsString,
} from 'nestjs-swagger-dto';

import { GrantResponse } from '../../grant/responses';

/** Admin view of a redeem code (includes the code VALUE — admin-only routes). */
export class RedeemCodeResponse {
  @IsString()
  id: string;

  @IsString()
  code: string;

  @IsEnum({ enum: { BlogAccessTier } })
  tier: BlogAccessTier;

  @IsNumber({ type: 'integer', optional: true, nullable: true })
  durationDays: number | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  expiresAt: Date | null;

  @IsString({ optional: true, nullable: true })
  redeemedById: string | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  redeemedAt: Date | null;

  @IsString({ isDate: { format: 'date-time' }, optional: true, nullable: true })
  revokedAt: Date | null;

  @IsDate({ format: 'date-time' })
  createdAt: Date;

  @IsDate({ format: 'date-time' })
  updatedAt: Date;
}

export class CodeListResponse {
  @IsNumber({ type: 'integer' })
  total: number;

  @IsNested({ type: RedeemCodeResponse, isArray: true })
  codes: RedeemCodeResponse[];
}

/** End-user redeem result — carries the resulting grant, never the code value. */
export class RedeemResultResponse {
  @IsString()
  message: string;

  @IsNested({ type: GrantResponse })
  grant: GrantResponse;
}
